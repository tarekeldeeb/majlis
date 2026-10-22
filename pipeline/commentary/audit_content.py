#!/usr/bin/env python3
"""Audit the Riyad corpus before TTS: commentary completeness, matn coverage,
and diacritic density.

Usage (from repo root): python3 -I pipeline/commentary/audit_content.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"
REPORT = ROOT / "content/books/riyad_assalihin/content-audit.json"

ARABIC = re.compile(r"[ء-ي]")
DIAC = re.compile(r"[ً-ْٰ]")
LATIN = re.compile(r"[A-Za-z]")


def density(text):
    letters = len(ARABIC.findall(text))
    return len(DIAC.findall(text)) / letters if letters else 0.0


def main():
    docs = []
    for fp in sorted(HADITH_DIR.glob("*.json")):
        docs.append(json.loads(fp.read_text(encoding="utf-8")))

    problems = []
    commentary_count = 0
    audio_count = 0
    for d in docs:
        n = d["number"]
        c = d.get("commentary") or {}
        if c.get("fawaid"):
            commentary_count += 1
        if d.get("audio", {}).get("matn"):
            audio_count += 1

        if not (2 <= len(c.get("adab") or []) <= 5):
            problems.append(f"{n}: adab count {len(c.get('adab') or [])}")
        if not (2 <= len(c.get("fawaid") or []) <= 5):
            problems.append(f"{n}: fawaid count {len(c.get('fawaid') or [])}")
        if not (c.get("meaning") or "").strip():
            problems.append(f"{n}: empty meaning")
        if not (1 <= len(c.get("sources") or []) <= 2):
            problems.append(f"{n}: sources count {len(c.get('sources') or [])}")

        texts = list(c.get("adab") or []) + list(c.get("fawaid") or []) + [c.get("meaning", "")]
        for i, t in enumerate(texts):
            if not isinstance(t, str) or not t.strip():
                problems.append(f"{n}: empty commentary string {i}")
                continue
            if LATIN.search(t):
                problems.append(f"{n}: Latin in commentary {i}")
            if density(t) < 0.45:
                problems.append(f"{n}: low commentary density {density(t):.2f} ({i})")

        md = d.get("matn", {}).get("diacritized", "")
        if not md:
            problems.append(f"{n}: no diacritized matn")
        else:
            ratio = len(ARABIC.findall(md)) / max(1, len(ARABIC.findall(d["matn"]["arabic"])))
            if not (0.9 <= ratio <= 1.1):
                problems.append(f"{n}: matn letter ratio {ratio:.2f}")
            if density(md) < 0.45:
                problems.append(f"{n}: low matn density {density(md):.2f}")

    report = {
        "checked": len(docs),
        "withCommentary": commentary_count,
        "withAudio": audio_count,
        "problems": problems,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"checked {len(docs)}, commentary {commentary_count}, audio {audio_count}, problems {len(problems)}")
    for p in problems[:30]:
        print(" -", p)


if __name__ == "__main__":
    main()
