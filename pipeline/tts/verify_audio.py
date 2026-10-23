#!/usr/bin/env python3
"""Verify generated TTS audio against the content files.

Checks that every approved hadith has non-empty matn and commentary MP3s,
reports durations and words-per-second, and flags missing/suspicious files.
Writes a Markdown report and (optionally) a local HTML listening page.

Usage (from repo root):
  python3 -I pipeline/tts/verify_audio.py --book nawawi40
  python3 -I pipeline/tts/verify_audio.py --book nawawi40 --html
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "content/books"
AUDIO = ROOT / "content/audio"
WIDTH = {"nawawi40": 3, "riyad_assalihin": 4}


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


def commentary_text(c: dict) -> str:
    parts = list(c.get("adab") or []) + list(c.get("fawaid") or []) + [c.get("meaning", "")]
    return " ".join(p.strip() for p in parts if isinstance(p, str) and p.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="nawawi40")
    ap.add_argument("--html", action="store_true", help="also write a local listening page")
    args = ap.parse_args()

    width = WIDTH.get(args.book, 3)
    book_dir = BOOKS / args.book / "hadith"
    audio_dir = AUDIO / args.book
    rows = []
    missing = []
    flags = []

    for fp in sorted(book_dir.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        if doc.get("review", {}).get("status") != "approved":
            continue
        num = doc["number"]
        matn_mp3 = audio_dir / f"{num:0{width}d}-matn.mp3"
        comm_mp3 = audio_dir / f"{num:0{width}d}-commentary.mp3"
        matn_text = doc["matn"].get("diacritized") or doc["matn"].get("arabic", "")
        comm_text = commentary_text(doc.get("commentary") or {})
        row = {
            "number": num,
            "chapter": (doc.get("chapter") or {}).get("title", ""),
            "matn_words": word_count(matn_text),
            "comm_words": word_count(comm_text),
            "matn_mp3": matn_mp3,
            "comm_mp3": comm_mp3,
            "matn_sec": duration(matn_mp3) if matn_mp3.exists() else None,
            "comm_sec": duration(comm_mp3) if comm_mp3.exists() else None,
        }
        rows.append(row)
        for kind, path, sec, words in (
            ("matn", matn_mp3, row["matn_sec"], row["matn_words"]),
            ("commentary", comm_mp3, row["comm_sec"], row["comm_words"]),
        ):
            if not path.exists() or path.stat().st_size == 0:
                missing.append(f"{num:0{width}d}-{kind}")
                continue
            if sec is None:
                flags.append(f"{num:0{width}d}-{kind}: unreadable duration")
                continue
            if sec < 3:
                flags.append(f"{num:0{width}d}-{kind}: only {sec}s")
            elif words and (sec / words > 1.2 or sec / words < 0.18):
                flags.append(f"{num:0{width}d}-{kind}: {sec}s for {words} words ({sec/words:.2f}s/word)")

    report = audio_dir / "verification.md"
    lines = [
        f"# TTS verification — {args.book}",
        "",
        f"- Approved hadiths: {len(rows)}",
        f"- MP3s present: {len(rows) * 2 - len(missing)} / {len(rows) * 2}",
        f"- Missing files: {len(missing)}",
        f"- Flags: {len(flags)}",
        "",
    ]
    if missing:
        lines += ["## Missing", "", ", ".join(missing), ""]
    if flags:
        lines += ["## Flags", ""] + [f"- {f}" for f in flags] + [""]
    lines += [
        "## Files",
        "",
        "| # | Chapter | Matn | Commentary | Matn s | Comm s |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for r in rows:
        mark = "—" if r["matn_sec"] is None else str(r["matn_sec"])
        cmark = "—" if r["comm_sec"] is None else str(r["comm_sec"])
        lines.append(
            f"| {r['number']} | {r['chapter']} | {r['matn_words']} w | "
            f"{r['comm_words']} w | {mark} | {cmark} |"
        )
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")

    if args.html:
        html = [
            "<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'>",
            "<title>TTS verification — nawawi40</title>",
            "<style>body{font-family:system-ui;margin:2rem;max-width:900px}"
            "h2{margin-top:2rem}audio{display:block;margin:.4rem 0 1rem}</style>",
            "<h1>TTS verification — nawawi40</h1>",
            "<p>Listen to each file; flag any mispronunciation, skipped text, or wrong voice.</p>",
        ]
        for r in rows:
            if not (r["matn_mp3"].exists() or r["comm_mp3"].exists()):
                continue
            html.append(f"<h2>الحديث {r['number']} — {r['chapter']}</h2>")
            if r["matn_mp3"].exists():
                html.append(f"<div>المتن</div><audio controls preload='none' src='{r['matn_mp3'].name}'></audio>")
            if r["comm_mp3"].exists():
                html.append(f"<div>الشرح (آداب/فوائد/معنى)</div><audio controls preload='none' src='{r['comm_mp3'].name}'></audio>")
        html.append("</html>")
        (audio_dir / "verification.html").write_text("\n".join(html), encoding="utf-8")

    print(f"approved: {len(rows)}; missing: {len(missing)}; flags: {len(flags)}")
    print(f"report: {report}")
    if args.html:
        print(f"listening page: {audio_dir / 'verification.html'}")


if __name__ == "__main__":
    main()
