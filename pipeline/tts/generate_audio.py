#!/usr/bin/env python3
"""Generate SILMA TTS audio for approved Majlis hadiths.

Writes one HE-AAC (.m4a) clip per segment (number, matn, adab, fawaid,
meaning) under `content/audio/<bookId>/` and records each clip's relative path
in the hadith's `audio` field as soon as it exists. Crash-safe and resumable:
clips and hadith files are replaced atomically, so a rerun skips every clip
already written and never mistakes a cut-off one for finished.

Run with the eval venv and the macOS library path:
  source .cache/eval-venv/bin/activate
  export SSL_CERT_FILE=$(python3 -c 'import certifi; print(certifi.where())')
  export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
  python3 -I pipeline/tts/generate_audio.py --book nawawi40 --limit 5

Examples:
  python3 -I pipeline/tts/generate_audio.py --book nawawi40
  python3 -I pipeline/tts/generate_audio.py --book riyad_assalihin --start 1 --limit 100
  python3 -I pipeline/tts/generate_audio.py --book all --nfe-step 8 --speed 1.05

Default voices:
  - matn/number: ClArTTS clip `ch_05_arabic_tts_dataset_177.wav` (single male
    speaker, Classical Arabic, CC-BY-4.0) — `pipeline/tts/voices/clartts107.wav`.
  - commentary (adab/fawaid/meaning): Arabic Speech Corpus male speaker
    (Nawar Halabi, CC-BY-4.0) — `pipeline/tts/voices/arabic-speech-corpus-male.wav`.

Override either voice with `--matn-ref-audio`/`--matn-ref-text-file` and
`--comm-ref-audio`/`--comm-ref-text-file`. SILMA conditions on a reference clip
of at most ~8 seconds; the transcript must match it word-for-word and should be
fully diacritized.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# TTS runs entirely locally from the Hugging Face cache; forbid runtime hub requests.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from silma_tts.api import SilmaTTS
import silma_tts.infer.utils_infer as ui

sys.path.insert(0, str(Path(__file__).resolve().parent))
from synth import synthesize, synthesize_items
from arabic_numbers import hadith_number_text
from audio_format import AUDIO_EXT, ENCODE

ROOT = Path(__file__).resolve().parents[2]
BOOKS_DIR = ROOT / "content/books"
AUDIO_DIR = ROOT / "content/audio"
TITLE_DIR = AUDIO_DIR / "titles"
SEGMENT_ORDER = ("number", "matn", "adab", "fawaid", "meaning")
TITLES = {
    "adab": "الْآدَابُ",
    "fawaid": "الْفَوَائِدُ",
    "meaning": "الْمَعْنَى الْإِجْمَالِيُّ",
}
MATN_REF_AUDIO = ROOT / "pipeline/tts/voices/clartts107.wav"
MATN_REF_TEXT = "أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ شَرُّ مَا أُعْطِيَ الْعَبْدُ"
COMM_REF_AUDIO = ROOT / "pipeline/tts/voices/arabic-speech-corpus-male.wav"
COMM_REF_TEXT = "لِيَتَمَكَّنَ الْقَارِئُ مِنْ مُتَابَعَةِ تَطَوُّرِ الْقِصَّةِ الْخَبَرِيَّةِ بِشَكْلٍ سَلِسٍ وَفَعَّالٍ"
STATE = AUDIO_DIR / "generation-state.json"
STT_LOG = AUDIO_DIR / "stt-check.jsonl"  # one line per chunk: every take's score and transcript

WIDTH = {"nawawi40": 3, "riyad_assalihin": 4}
BIDI = re.compile(r"[‎‏‪-‮]")


CHUNK_LIMIT = 180
CROSSFADE = 0.02
BULLET_PAUSE = 0.8

_orig_chunk_text = ui.chunk_text


def chunk_text_f5(text, max_chars=120):
    """Use F5-TTS punctuation-aware chunking with its quality-sized chunks."""
    return _orig_chunk_text(text, max_chars=CHUNK_LIMIT)


ui.chunk_text = chunk_text_f5


SALLA = "صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ"
SALLA_RE = re.compile(
    r"صلى\s+الله\s+عليه\s+(?:و\s*)?(?:آل(?:ه|هِ)?\s+)?(?:و\s*)?سلم"
)
SALLA_ALT_RE = re.compile(r"عليه\s+الصلاة\s+والسلام")


def tts_text(text):
    """Normalize one read-aloud string without changing its wording."""
    s = text.replace("ﷺ", SALLA)
    s = SALLA_RE.sub(SALLA, s)
    s = SALLA_ALT_RE.sub("عَلَيْهِ الصَّلَاةُ وَالسَّلَامُ", s)
    s = BIDI.sub("", s)
    # Drop footnote markers / bare citation numbers; they are for display, not speech.
    s = re.sub(r"\([0-9٠-٩۰-۹]+\)", " ", s)
    s = re.sub(r"(?<=\s)[0-9٠-٩۰-۹]+(?=[\s.)،]|$)", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s and s[-1] not in ".!؟؛":
        s += "."
    return s


def segment_texts(doc):
    """Read-aloud text for each independently toggleable segment."""
    c = doc.get("commentary") or {}
    adab = c.get("adab") or []
    fawaid = c.get("fawaid") or []
    meaning = c.get("meaning") or ""
    return {
        "number": tts_text(hadith_number_text(doc["number"])),
        "matn": tts_text(doc["matn"].get("diacritized") or doc["matn"]["arabic"]),
        "adab": tts_text(" ".join(adab)) if adab else "",
        "fawaid": tts_text(" ".join(fawaid)) if fawaid else "",
        "meaning": tts_text(meaning) if meaning else "",
    }


def segment_item_texts(doc, kind):
    """Bullet texts for adab/fawaid, or a single text for other segments."""
    c = doc.get("commentary") or {}
    if kind == "adab":
        items = c.get("adab") or []
    elif kind == "fawaid":
        items = c.get("fawaid") or []
    else:
        return [segment_texts(doc)[kind]]
    return [tts_text(item) for item in items if isinstance(item, str) and item.strip()]


def segment_paths(book, num):
    width = WIDTH.get(book, 3)
    base = AUDIO_DIR / book
    return {kind: base / f"{num:0{width}d}-{kind}{AUDIO_EXT}" for kind in SEGMENT_ORDER}


def valid_audio(path):
    return path.exists() and path.stat().st_size > 0


def commentary_text(c):
    parts = list(c.get("adab") or []) + list(c.get("fawaid") or []) + [c.get("meaning", "")]
    return tts_text(" ".join(p.strip() for p in parts if isinstance(p, str) and p.strip()))


def encode_audio(wav_path, out_path):
    """Encode beside the target and rename into place: a crash never leaves a cut-off
    clip that a resumed run would take for finished."""
    part = out_path.with_name(out_path.stem + ".part" + out_path.suffix)
    base = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-threads", "1", "-i", str(wav_path), *ENCODE]
    attempts = [
        base + ["-af", "afade=t=in:st=0:d=0.02", str(part)],
        base + [str(part)],
    ]
    last_error = None
    for command in attempts:
        try:
            subprocess.run(command, check=True)
            os.replace(part, out_path)
            wav_path.unlink(missing_ok=True)
            return
        except subprocess.CalledProcessError as exc:
            last_error = exc
    raise last_error


def write_json(fp, doc):
    """Replace a hadith file atomically, so a crash mid-write cannot cut it short."""
    tmp = fp.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, fp)


def record_audio(fp, book, paths):
    """Point the hadith's audio fields at every clip that exists, re-reading the file
    first so a long run never overwrites edits made to it meanwhile."""
    doc = json.loads(fp.read_text(encoding="utf-8"))
    audio = dict(doc.get("audio") or {})
    for kind, path in paths.items():
        audio[kind] = f"{book}/{path.name}" if valid_audio(path) else None
    doc["audio"] = audio
    write_json(fp, doc)
    return doc


def load_state():
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            pass
    return {"startedAt": None, "generated": {}, "failures": []}


def save_state(state):
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(STATE)


def pending(book, start, limit, force):
    book_dir = BOOKS_DIR / book / "hadith"
    docs = []
    for fp in sorted(book_dir.glob("*.json")):
        doc = json.loads(fp.read_text())
        if doc.get("review", {}).get("status") != "approved":
            continue
        if not (doc.get("matn", {}).get("diacritized") or doc.get("matn", {}).get("arabic")):
            continue
        num = doc["number"]
        if num < start:
            continue
        texts = segment_texts(doc)
        paths = segment_paths(book, num)
        missing = [
            kind for kind in SEGMENT_ORDER
            if texts[kind] and (force or not valid_audio(paths[kind]))
        ]
        if missing:
            docs.append((fp, doc, paths, missing, texts))
        if limit and len(docs) >= limit:
            break
    return docs


def titles_pending(force):
    return [key for key in TITLES if force or not valid_audio(TITLE_DIR / f"{key}{AUDIO_EXT}")]


def log_stt(state, item_id, report):
    """Record what Whisper heard for every take of every chunk, and show the retried ones.

    Every chunk is appended to STT_LOG; a chunk that needed another take is printed
    with each take's score and transcript, and one that never came out whole is
    also kept under state["sttWeak"].
    """
    at = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    with STT_LOG.open("a", encoding="utf-8") as log:
        for r in report:
            log.write(json.dumps({"id": item_id, "at": at, **r}, ensure_ascii=False) + "\n")
    retried = [r for r in report if r["attempts"] > 1]
    weak = [r for r in report if r["score"] < 0.5]
    if not (retried or weak):
        return
    print(f"  STT {item_id}: {len(retried)} chunk(s) retried, {len(weak)} still weak", flush=True)
    for r in report:
        if r["attempts"] == 1 and r["score"] >= 0.5:
            continue
        print(f"    {'weak' if r['score'] < 0.5 else 'retried'}: {r['chunk']}", flush=True)
        for n, take in enumerate(r["takes"], 1):
            mark = "  <- kept" if n == r["kept"] else ""
            print(f"      take {n} ({take['score']:.2f}): {take['heard']}{mark}", flush=True)
        if r["score"] < 0.5:
            state.setdefault("sttWeak", []).append({"id": item_id, **r})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="all", help="book id, 'all', or a comma-separated list")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0, help="max hadiths per book (0 = all)")
    ap.add_argument("--nfe-step", type=int, default=32)
    ap.add_argument("--speed", type=float, default=0.77,
                    help="matn/number speed; SILMA multiplies this by 1.3 for diacritized text; 0.77 -> effective 1.0")
    ap.add_argument("--comm-speed", type=float, default=0.84,
                    help="commentary speed; 0.84 -> effective 1.09")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--titles", default="",
                    help="regenerate only these title clips (comma-separated), skipping hadith audio")
    ap.add_argument("--skip-titles", action="store_true", help="leave the section title clips alone")
    ap.add_argument("--stt-check", action="store_true",
                    help="transcribe every chunk with Whisper and regenerate chunks that lost a word")
    ap.add_argument("--stt-attempts", type=int, default=4, help="takes per chunk under --stt-check")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--matn-ref-audio", default=str(MATN_REF_AUDIO), help="matn reference WAV (<= 8 s)")
    ap.add_argument("--matn-ref-text", default=MATN_REF_TEXT, help="exact matn reference transcript")
    ap.add_argument("--matn-ref-text-file", default="", help="read matn reference transcript from a file")
    ap.add_argument("--comm-ref-audio", default=str(COMM_REF_AUDIO), help="commentary reference WAV (<= 8 s)")
    ap.add_argument("--comm-ref-text", default=COMM_REF_TEXT, help="exact commentary reference transcript")
    ap.add_argument("--comm-ref-text-file", default="", help="read commentary reference transcript from a file")
    args = ap.parse_args()

    def resolve(audio, text, text_file, label):
        path = Path(audio)
        transcript = Path(text_file).read_text(encoding="utf-8").strip() if text_file else text
        if not path.exists():
            sys.exit(f"missing {label} reference audio: {path}")
        if not transcript:
            sys.exit(f"empty {label} reference transcript")
        return path, transcript

    matn_ref_audio, matn_ref_text = resolve(args.matn_ref_audio, args.matn_ref_text, args.matn_ref_text_file, "matn")
    comm_ref_audio, comm_ref_text = resolve(args.comm_ref_audio, args.comm_ref_text, args.comm_ref_text_file, "commentary")

    if args.titles:
        titles = [t.strip() for t in args.titles.split(",") if t.strip()]
        unknown = [t for t in titles if t not in TITLES]
        if unknown:
            sys.exit(f"unknown title(s): {', '.join(unknown)}")
        queue = []
    else:
        books = ["nawawi40", "riyad_assalihin"] if args.book == "all" else [b.strip() for b in args.book.split(",") if b.strip()]
        queue = []
        for book in books:
            queue.extend((book, *item) for item in pending(book, args.start, args.limit, args.force))
        titles = [] if args.skip_titles else titles_pending(args.force)

    print(
        f"queue: {len(queue)} hadith(s), {len(titles)} title clip(s); "
        f"matn speed={args.speed} ({args.speed*1.3:.2f}), "
        f"commentary speed={args.comm_speed} ({args.comm_speed*1.3:.2f})",
        flush=True,
    )
    print(f"matn/number voice: {matn_ref_audio} ({len(matn_ref_text.split())} words)", flush=True)
    print(f"commentary voice: {comm_ref_audio} ({len(comm_ref_text.split())} words)", flush=True)
    print(f"chunking: punctuation-aware <= {CHUNK_LIMIT} chars; crossfade={CROSSFADE}s", flush=True)
    if args.dry_run:
        for book, fp, doc, paths, missing, texts in queue[:20]:
            print(f"  {book}:{doc['number']} -> {','.join(missing)}")
        if titles:
            print(f"  titles -> {','.join(titles)}")
        return
    if not queue and not titles:
        return

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TITLE_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    if not state.get("startedAt"):
        state["startedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        save_state(state)

    print("loading SILMA...", flush=True)
    t0 = time.perf_counter()
    tts = SilmaTTS(enable_normalizer=False)
    print(f"loaded in {time.perf_counter() - t0:.1f}s", flush=True)
    stt = {}
    if args.stt_check:
        from stt_check import SttCheck
        stt = {"check": SttCheck(), "attempts": args.stt_attempts}
        print(f"STT check: Whisper on every chunk, up to {args.stt_attempts} takes; "
              f"transcripts -> {STT_LOG.relative_to(ROOT)}", flush=True)

    def note_stt(item_id, report):
        if stt:
            log_stt(state, item_id, report)

    ok = failed = 0
    run_start = time.perf_counter()
    voices = {"matn": (matn_ref_audio, matn_ref_text), "commentary": (comm_ref_audio, comm_ref_text)}

    for key in titles:
        out = TITLE_DIR / f"{key}{AUDIO_EXT}"
        try:
            wav = out.with_suffix(".wav")
            report = []
            wav_data, sr = synthesize(
                tts,
                comm_ref_audio,
                comm_ref_text,
                tts_text(TITLES[key]),
                nfe_step=args.nfe_step,
                speed=args.comm_speed,
                max_chars=CHUNK_LIMIT,
                fade_seconds=CROSSFADE,
                keep_start=0.2,
                lead_in=0.15,
                report=report,
                **stt,
            )
            tts.export_wav(wav_data, str(wav))
            encode_audio(wav, out)
            note_stt(f"title:{key}", report)
            print(f"title: {key} -> {out.name}", flush=True)
        except Exception as e:
            failed += 1
            state["failures"].append({"id": f"title:{key}", "error": str(e)})
            print(f"FAILED title:{key}: {e}", flush=True)

    for i, (book, fp, doc, paths, missing, texts) in enumerate(queue, 1):
        num = doc["number"]
        item_t = time.perf_counter()
        try:
            for kind in missing:
                ref_audio, ref_text = voices["matn" if kind in ("number", "matn") else "commentary"]
                out = paths[kind]
                out.parent.mkdir(parents=True, exist_ok=True)
                wav = out.with_suffix(".wav")
                segment_speed = args.speed if kind in ("number", "matn") else args.comm_speed
                report = []
                if kind in ("adab", "fawaid"):
                    wav_data, sr = synthesize_items(
                        tts,
                        ref_audio,
                        ref_text,
                        segment_item_texts(doc, kind),
                        nfe_step=args.nfe_step,
                        speed=segment_speed,
                        max_chars=CHUNK_LIMIT,
                        fade_seconds=CROSSFADE,
                        pause_seconds=BULLET_PAUSE,
                        report=report,
                        **stt,
                    )
                else:
                    wav_data, sr = synthesize(
                        tts,
                        ref_audio,
                        ref_text,
                        texts[kind],
                        nfe_step=args.nfe_step,
                        speed=segment_speed,
                        max_chars=CHUNK_LIMIT,
                        fade_seconds=CROSSFADE,
                        keep_start=0.2 if kind == "number" else 0.15,
                        report=report,
                        **stt,
                    )
                tts.export_wav(wav_data, str(wav))
                encode_audio(wav, out)
                note_stt(f"{book}:{num}:{kind}", report)
                # The clip counts the moment it exists, so a crash loses nothing done so far.
                doc = record_audio(fp, book, paths)

            doc = record_audio(fp, book, paths)
            audio = doc["audio"]

            # Once all three commentary parts exist, the old unsplit file is redundant.
            split_ready = all(
                texts[k] and valid_audio(paths[k]) for k in ("adab", "fawaid", "meaning")
            )
            if split_ready:
                legacy_rel = audio.get("commentary")
                legacy = (
                    AUDIO_DIR / legacy_rel
                    if legacy_rel
                    else AUDIO_DIR / book / f"{num:0{WIDTH.get(book, 3)}d}-commentary.mp3"
                )
                if legacy.exists():
                    rel = legacy.relative_to(ROOT)
                    try:
                        subprocess.run(
                            ["git", "-C", str(ROOT), "rm", "--quiet", "--", str(rel)],
                            check=True,
                        )
                        print(f"  git rm legacy commentary: {legacy.name}", flush=True)
                    except subprocess.CalledProcessError:
                        legacy.unlink(missing_ok=True)
                        print(f"  removed legacy commentary (untracked): {legacy.name}", flush=True)
                audio.pop("commentary", None)

            doc["audio"] = audio
            write_json(fp, doc)
            state["generated"][f"{book}:{num}"] = {
                "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "seconds": round(time.perf_counter() - item_t, 1),
            }
            ok += 1
            elapsed = time.perf_counter() - run_start
            eta = (elapsed / i) * (len(queue) - i) / 60
            print(
                f"[{i}/{len(queue)}] {book}:{num} {time.perf_counter()-item_t:.1f}s "
                f"segments={','.join(missing)} elapsed={elapsed/60:.1f}m eta={eta:.0f}m",
                flush=True,
            )
        except Exception as e:
            failed += 1
            state["failures"].append({"id": f"{book}:{num}", "error": str(e)})
            print(f"[{i}/{len(queue)}] FAILED {book}:{num}: {e}", flush=True)
        save_state(state)

    save_state(state)
    print(f"done: {ok} generated, {failed} failed, {time.perf_counter()-run_start:.0f}s total")


if __name__ == "__main__":
    main()
