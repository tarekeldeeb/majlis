#!/usr/bin/env python3
"""Verify generated TTS audio against the content files.

Checks every approved hadith's number, matn, and commentary segment clips plus
the shared title clips. Reports durations, words-per-second, missing files, and
suspicious durations. Writes a Markdown report and an optional local listening
page.

Usage (from repo root):
  python3 -I pipeline/tts/verify_audio.py --book nawawi40
  python3 -I pipeline/tts/verify_audio.py --book nawawi40 --html
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "content/books"
AUDIO_DIR = ROOT / "content/audio"
WIDTH = {"nawawi40": 3, "riyad_assalihin": 4}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arabic_numbers import hadith_number_text
from audio_format import AUDIO_EXT

SEGMENTS = [
    ("number", "رقم الحديث"),
    ("matn", "المتن"),
    ("adab", "الآداب"),
    ("fawaid", "الفوائد"),
    ("meaning", "المعنى الإجمالي"),
]
TITLES = [("adab", "الآداب"), ("fawaid", "الفوائد"), ("meaning", "المعنى الإجمالي")]


def duration(path: Path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, check=True,
        )
        return round(float(out.stdout.strip()), 1)
    except Exception:
        return None


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def segment_text(doc, key: str) -> str:
    commentary = doc.get("commentary") or {}
    if key == "number":
        return hadith_number_text(doc["number"])
    if key == "matn":
        return doc["matn"].get("diacritized") or doc["matn"].get("arabic", "")
    if key == "adab":
        return " ".join(commentary.get("adab") or [])
    if key == "fawaid":
        return " ".join(commentary.get("fawaid") or [])
    if key == "meaning":
        return commentary.get("meaning") or ""
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="nawawi40")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--html", action="store_true")
    args = ap.parse_args()

    width = WIDTH.get(args.book, 3)
    book_dir = BOOKS / args.book / "hadith"
    audio_dir = AUDIO_DIR / args.book
    rows = []
    missing = []
    flags = []
    checked = 0

    for fp in sorted(book_dir.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        if doc.get("review", {}).get("status") != "approved":
            continue
        num = doc["number"]
        if num < args.start:
            continue
        if args.limit and checked >= args.limit:
            break
        checked += 1
        audio = doc.get("audio") or {}
        for key, label in SEGMENTS:
            text = segment_text(doc, key)
            if not text:
                continue
            rel = audio.get(key)
            path = (AUDIO_DIR / rel) if rel else (audio_dir / f"{num:0{width}d}-{key}{AUDIO_EXT}")
            sec = duration(path) if path.exists() else None
            rows.append({"number": num, "key": key, "label": label, "path": path,
                         "words": word_count(text), "sec": sec})
            if not path.exists() or path.stat().st_size == 0:
                missing.append(f"{num:0{width}d}-{key}")
            elif sec is None:
                flags.append(f"{num:0{width}d}-{key}: unreadable duration")
            elif sec < 1:
                flags.append(f"{num:0{width}d}-{key}: only {sec}s")
            elif word_count(text) and not (0.12 <= sec / word_count(text) <= 1.3):
                flags.append(
                    f"{num:0{width}d}-{key}: {sec}s for {word_count(text)} words"
                )

        # Legacy single commentary file, if no split segments exist.
        if not any(audio.get(k) for k in ("adab", "fawaid", "meaning")):
            legacy = audio.get("commentary")
            if legacy:
                path = AUDIO_DIR / legacy
                if not path.exists() or path.stat().st_size == 0:
                    missing.append(f"{num:0{width}d}-commentary")
                else:
                    rows.append({"number": num, "key": "commentary",
                                 "label": "الشرح (قديم)", "path": path,
                                 "words": word_count(" ".join(segment_text(doc, k) for k in ("adab", "fawaid", "meaning"))),
                                 "sec": duration(path)})

    title_rows = []
    for key, label in TITLES:
        path = AUDIO_DIR / "titles" / f"{key}{AUDIO_EXT}"
        sec = duration(path) if path.exists() else None
        title_rows.append({"key": key, "label": label, "path": path, "sec": sec})
        if not path.exists() or path.stat().st_size == 0:
            missing.append(f"titles/{key}")

    out_dir = audio_dir if args.book != "all" else AUDIO_DIR
    report = out_dir / "verification.md"
    lines = [
        f"# TTS verification — {args.book}",
        "",
        f"- Hadiths checked: {len({r['number'] for r in rows})}",
        f"- Segment files present: {len(rows) - len(missing)} / {len(rows)}",
        f"- Shared titles present: {sum(1 for t in title_rows if t['sec'] is not None)} / {len(title_rows)}",
        f"- Missing: {len(missing)}",
        f"- Flags: {len(flags)}",
        "",
    ]
    if missing:
        lines += ["## Missing", "", ", ".join(missing), ""]
    if flags:
        lines += ["## Flags", ""] + [f"- {f}" for f in flags] + [""]
    lines += ["## Segments", "", "| # | Segment | Words | Seconds |", "|---|---|---:|---:|"]
    for r in rows:
        lines.append(
            f"| {r['number']} | {r['label']} | {r['words']} | {r['sec'] if r['sec'] is not None else '—'} |"
        )
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")

    if args.html:
        html = [
            "<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'>",
            f"<title>TTS verification — {args.book}</title>",
            "<style>body{font-family:system-ui;margin:2rem;max-width:900px}"
            "h2{margin-top:2rem}audio{display:block;margin:.35rem 0 .9rem}</style>",
            f"<h1>TTS verification — {args.book}</h1>",
            "<h2>Shared titles</h2>",
        ]
        for t in title_rows:
            if t["path"].exists():
                html.append(
                    f"<div>{t['label']}</div><audio controls preload='none' "
                    f"src='../titles/{t['key']}{AUDIO_EXT}'></audio>"
                )
        for number in sorted({r["number"] for r in rows}):
            html.append(f"<h2>الحديث {number}</h2>")
            for r in [x for x in rows if x["number"] == number]:
                if not r["path"].exists():
                    continue
                html.append(
                    f"<div>{r['label']}</div><audio controls preload='none' "
                    f"src='{r['path'].name}'></audio>"
                )
        html.append("</html>")
        (out_dir / "verification.html").write_text("\n".join(html), encoding="utf-8")

    print(f"segments: {len(rows)}; missing: {len(missing)}; flags: {len(flags)}")
    print(f"report: {report}")
    if args.html:
        print(f"listening page: {out_dir / 'verification.html'}")


if __name__ == "__main__":
    main()
