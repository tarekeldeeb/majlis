#!/usr/bin/env python3
"""Generate SILMA TTS audio for approved Majlis hadiths.

Writes one matn MP3 and one commentary MP3 per hadith under
`content/audio/<bookId>/`, then records the relative paths in each hadith's
`audio` field. Resumable: existing non-empty MP3s are skipped.

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
  - matn: ClArTTS clip `ch_05_arabic_tts_dataset_177.wav` (single male speaker,
    Classical Arabic, CC-BY-4.0) — `pipeline/tts/voices/clartts107.wav`.
  - commentary (adab/fawaid/meaning): SILMA's bundled reference
    `ar.ref.24k.wav` (female) — `pipeline/tts/voices/silma-default-female.wav`.

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

ROOT = Path(__file__).resolve().parents[2]
BOOKS_DIR = ROOT / "content/books"
AUDIO_DIR = ROOT / "content/audio"
MATN_REF_AUDIO = ROOT / "pipeline/tts/voices/clartts107.wav"
MATN_REF_TEXT = "أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ شَرُّ مَا أُعْطِيَ الْعَبْدُ"
COMM_REF_AUDIO = ROOT / "pipeline/tts/voices/silma-default-female.wav"
COMM_REF_TEXT = "ويدقق النظر في القرآن الكريم وسائر الكتب السماوية ويتبع مسالك الرسل العظام عليهم الصلاة والسلام."
STATE = AUDIO_DIR / "generation-state.json"

WIDTH = {"nawawi40": 3, "riyad_assalihin": 4}
BIDI = re.compile(r"[‎‏‪-‮]")


SENT = re.compile(r"(?<=[.!?؛])\s+")
CHUNK_LIMIT = 180
CROSSFADE = 0.15


def chunk_sentence(text, max_chars=120, limit=CHUNK_LIMIT):
    """Sentence-aware chunks: never split immediately after a comma/colon."""
    sentences = [s.strip() for s in SENT.split(text) if s.strip()]
    chunks, cur = [], ""
    for s in sentences:
        if not cur:
            cur = s
        elif len(cur) + 1 + len(s) <= limit:
            cur += " " + s
        else:
            chunks.append(cur)
            cur = s
        while len(cur) > limit:
            cut = cur.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            chunks.append(cur[:cut].strip())
            cur = cur[cut:].strip()
    if cur:
        chunks.append(cur)
    return chunks


ui.chunk_text = chunk_sentence


def tts_text(text):
    """Normalize one read-aloud string without changing its wording."""
    s = text.replace("ﷺ", "صلى الله عليه وسلم")
    s = BIDI.sub("", s)
    # Drop footnote markers / bare citation numbers; they are for display, not speech.
    s = re.sub(r"\([0-9٠-٩۰-۹]+\)", " ", s)
    s = re.sub(r"(?<=\s)[0-9٠-٩۰-۹]+(?=[\s.)،]|$)", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s and s[-1] not in ".!؟؛":
        s += "."
    return s


def commentary_text(c):
    parts = list(c.get("adab") or []) + list(c.get("fawaid") or []) + [c.get("meaning", "")]
    return tts_text(" ".join(p.strip() for p in parts if isinstance(p, str) and p.strip()))


def to_mp3(wav_path, mp3_path):
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(wav_path),
            "-ac", "1", "-ar", "24000", "-b:a", "96k",
            "-af", "afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.02,areverse",
            str(mp3_path),
        ],
        check=True,
    )
    wav_path.unlink(missing_ok=True)


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
        width = WIDTH.get(book, 3)
        matn_mp3 = AUDIO_DIR / book / f"{num:0{width}d}-matn.mp3"
        comm_mp3 = AUDIO_DIR / book / f"{num:0{width}d}-commentary.mp3"
        if force or not (matn_mp3.exists() and matn_mp3.stat().st_size and comm_mp3.exists() and comm_mp3.stat().st_size):
            docs.append((fp, doc, matn_mp3, comm_mp3))
        if limit and len(docs) >= limit:
            break
    return docs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="all", help="book id, 'all', or a comma-separated list")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0, help="max hadiths per book (0 = all)")
    ap.add_argument("--nfe-step", type=int, default=16)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--force", action="store_true")
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

    books = ["nawawi40", "riyad_assalihin"] if args.book == "all" else [b.strip() for b in args.book.split(",") if b.strip()]
    queue = []
    for book in books:
        queue.extend((book, fp, doc, matn_mp3, comm_mp3) for fp, doc, matn_mp3, comm_mp3 in pending(book, args.start, args.limit, args.force))

    print(f"queue: {len(queue)} hadith(s); nfe_step={args.nfe_step} speed={args.speed}", flush=True)
    print(f"matn voice: {matn_ref_audio} ({len(matn_ref_text.split())} words)", flush=True)
    print(f"commentary voice: {comm_ref_audio} ({len(comm_ref_text.split())} words)", flush=True)
    print(f"chunking: sentence-aware <= {CHUNK_LIMIT} chars; crossfade={CROSSFADE}s", flush=True)
    if args.dry_run:
        for book, fp, doc, _, _ in queue[:20]:
            print(f"  {book}:{doc['number']}")
        return
    if not queue:
        return

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    if not state.get("startedAt"):
        state["startedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        save_state(state)

    print("loading SILMA...", flush=True)
    t0 = time.perf_counter()
    tts = SilmaTTS(enable_normalizer=False)
    print(f"loaded in {time.perf_counter() - t0:.1f}s", flush=True)

    ok = failed = 0
    run_start = time.perf_counter()
    voices = {"matn": (matn_ref_audio, matn_ref_text), "commentary": (comm_ref_audio, comm_ref_text)}
    for i, (book, fp, doc, matn_mp3, comm_mp3) in enumerate(queue, 1):
        num = doc["number"]
        matn_mp3.parent.mkdir(parents=True, exist_ok=True)
        item_t = time.perf_counter()
        try:
            for kind, text, out in (
                ("matn", tts_text(doc["matn"].get("diacritized") or doc["matn"]["arabic"]), matn_mp3),
                ("commentary", commentary_text(doc.get("commentary") or {}), comm_mp3),
            ):
                if args.force or not (out.exists() and out.stat().st_size):
                    ref_audio, ref_text = voices[kind]
                    wav = out.with_suffix(".wav")
                    tts.infer(
                        ref_file=str(ref_audio),
                        ref_text=ref_text,
                        gen_text=text,
                        file_wave=str(wav),
                        normalize_numbers=False,
                        force_tashkeel=False,
                        nfe_step=args.nfe_step,
                        speed=args.speed,
                        cross_fade_duration=CROSSFADE,
                    )
                    to_mp3(wav, out)
            doc["audio"] = {
                "matn": f"{book}/{matn_mp3.name}",
                "commentary": f"{book}/{comm_mp3.name}",
            }
            fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
            state["generated"][f"{book}:{num}"] = {
                "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "seconds": round(time.perf_counter() - item_t, 1),
            }
            ok += 1
            elapsed = time.perf_counter() - run_start
            eta = (elapsed / i) * (len(queue) - i) / 60
            print(
                f"[{i}/{len(queue)}] {book}:{num} {time.perf_counter()-item_t:.1f}s "
                f"elapsed={elapsed/60:.1f}m eta={eta:.0f}m",
                flush=True,
            )
        except Exception as e:
            failed += 1
            state["failures"].append({"id": f"{book}:{num}", "error": str(e)})
            print(f"[{i}/{len(queue)}] FAILED {book}:{num}: {e}", flush=True)
        if i % 5 == 0 or i == len(queue):
            save_state(state)

    save_state(state)
    print(f"done: {ok} generated, {failed} failed, {time.perf_counter()-run_start:.0f}s total")


if __name__ == "__main__":
    main()
