#!/usr/bin/env python3
"""Diacritize Riyad commentary text with CATT before TTS.

Runs over adab/fawaid/meaning strings and writes the diacritized text back.
Punctuation and ﷺ are preserved exactly by `catt_preserve`. The matn is not
touched.

Run with the eval venv:
  .cache/eval-venv/bin/python -I pipeline/diacritize/diacritize_commentary.py
"""

import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from catt_tashkeel import CATTEncoderDecoder
sys.path.insert(0, str(Path(__file__).resolve().parent))
from catt_preserve import collect, rebuild

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"
ARABIC = re.compile(r"[ء-ي]")
DIAC = re.compile(r"[ً-ْٰ]")


def density(text):
    letters = len(ARABIC.findall(text))
    return len(DIAC.findall(text)) / letters if letters else 1.0


def main():
    docs = []
    for fp in sorted(HADITH_DIR.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        c = doc.get("commentary") or {}
        if not (c.get("adab") or c.get("fawaid") or c.get("meaning")):
            continue
        docs.append((fp, doc))
    print(f"hadiths with commentary: {len(docs)}", file=sys.stderr)
    if not docs:
        return

    texts, refs = [], []
    for di, (_, doc) in enumerate(docs):
        c = doc["commentary"]
        fields = [("meaning", [c.get("meaning", "")])]
        fields.append(("adab", c.get("adab") or []))
        fields.append(("fawaid", c.get("fawaid") or []))
        for field, items in fields:
            for ii, text in enumerate(items):
                if isinstance(text, str) and text.strip() and density(text) < 0.55:
                    texts.append(text)
                    refs.append((di, field, ii))
    print(f"texts needing diacritization: {len(texts)}", file=sys.stderr)
    if not texts:
        print("nothing to do")
        return

    jobs, plan = collect(texts)
    print(f"chunks: {len(jobs)}; loading CATT...", file=sys.stderr)
    model = CATTEncoderDecoder()
    outputs = model.do_tashkeel_batch(jobs, batch_size=16, verbose=False)
    print("writing...", file=sys.stderr)

    # Rebuild into a per-doc structure.
    out = {}
    for i, (di, field, ii) in enumerate(refs):
        out.setdefault(di, {}).setdefault(field, {})[ii] = rebuild(plan, outputs, i)

    done = 0
    for di, (fp, doc) in enumerate(docs):
        c = doc["commentary"]
        for field, items in (("meaning", [c.get("meaning", "")]), ("adab", c.get("adab") or []), ("fawaid", c.get("fawaid") or [])):
            new_items = []
            for ii, text in enumerate(items):
                if isinstance(text, str) and text.strip():
                    new_items.append(re.sub(r"[ \t]+", " ", out[di][field][ii]).strip())
                else:
                    new_items.append(text)
            if field == "meaning":
                c["meaning"] = new_items[0]
            else:
                c[field] = new_items
        c["diacritizationSource"] = {
            "method": "catt-auto",
            "model": "abjadai/catt (encoder-decoder)",
            "checkedAt": "2026-10-22",
        }
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done += 1
        if done % 100 == 0:
            print(f"  written {done}/{len(docs)}", file=sys.stderr)
    print(f"done: {done}")


if __name__ == "__main__":
    main()
