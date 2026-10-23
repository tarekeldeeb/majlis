#!/usr/bin/env python3
"""Normalize hadith JSON text: strip newlines/tabs/bidi and use «» quotes.

This is a text-only cleanup. It does not change review fields. Idempotent.

Usage (from repo root):
  python3 -I pipeline/ingest/normalize_book_text.py nawawi40
  python3 -I pipeline/ingest/normalize_book_text.py nawawi40 riyad_assalihin
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS_DIR = ROOT / "content/books"

WS = re.compile(r"[\r\n\t]+")
BIDI = re.compile(r"[‎‏‪-‮⁦-⁩]")
MULTISPACE = re.compile(r"[  ]{2,}")
CURLY = str.maketrans({"“": "«", "”": "»"})


def normalize_quotes(text):
    text = text.translate(CURLY)
    # Repair an opening quote that was rendered as a closing guillemet.
    text = re.sub(r"([:،.؛!؟(]\s)»", r"\1«", text)
    out = []
    for i, ch in enumerate(text):
        if ch != '"':
            out.append(ch)
            continue
        prev = text[i - 1] if i else ""
        j = i + 1
        while j < len(text) and text[j].isspace():
            j += 1
        nxt = text[j] if j < len(text) else ""
        opening = (prev == "" or prev in " \n\t:،.؛!؟(") and nxt not in ".,؛!؟)"
        out.append("«" if opening else "»")
    return "".join(out)


def clean(value):
    if isinstance(value, str):
        value = WS.sub(" ", value)
        value = BIDI.sub("", value)
        value = normalize_quotes(value)
        value = MULTISPACE.sub(" ", value)
        return value.strip()
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value


def main():
    books = sys.argv[1:] or ["nawawi40", "riyad_assalihin"]
    for book in books:
        book_dir = BOOKS_DIR / book / "hadith"
        if not book_dir.exists():
            sys.exit(f"missing {book_dir}")
        changed = 0
        for fp in sorted(book_dir.glob("*.json")):
            doc = json.loads(fp.read_text(encoding="utf-8"))
            before = json.dumps(doc, ensure_ascii=False, sort_keys=True)
            for key in ("matn", "commentary", "chapter", "audio"):
                if key in doc:
                    doc[key] = clean(doc[key])
            if json.dumps(doc, ensure_ascii=False, sort_keys=True) != before:
                changed += 1
            fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{book}: normalized {changed} file(s)")


if __name__ == "__main__":
    main()
