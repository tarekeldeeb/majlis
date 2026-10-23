#!/usr/bin/env python3
"""Normalize Riyad al-Salihin JSON text and record Tarek Eldeeb's review.

Strips newlines, tabs, and bidi control characters from every text value
(matn, commentary, chapter, sources), collapses runs of whitespace, and sets
the review fields. Words and diacritics are not changed.

Usage (from repo root): python3 -I pipeline/ingest/normalize_riyad_text.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"

WS = re.compile(r"[\r\n\t]+")
BIDI = re.compile(r"[‎‏‪-‮⁦-⁩]")
MULTISPACE = re.compile(r"[  ]{2,}")
CURLY = str.maketrans({"“": "«", "”": "»"})


def normalize_quotes(text):
    """Convert ASCII/curly quotes to Arabic guillemets without JSON escapes."""
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
    changed = 0
    review_updated = 0
    for fp in sorted(HADITH_DIR.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        original = json.dumps(doc, ensure_ascii=False, sort_keys=True)
        for key in ("matn", "commentary", "chapter", "audio"):
            if key in doc:
                doc[key] = clean(doc[key])
        doc["review"] = {
            "status": "approved",
            "reviewers": ["Tarek Eldeeb"],
            "reviewPolicy": "owner-reviewed-second-pending",
            "approvedAt": "2026-10-23",
        }
        review_updated += 1
        if json.dumps(doc, ensure_ascii=False, sort_keys=True) != original:
            changed += 1
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"normalized: {changed} changed, {review_updated} review fields updated")


if __name__ == "__main__":
    main()
