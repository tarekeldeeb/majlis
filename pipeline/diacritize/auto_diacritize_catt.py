#!/usr/bin/env python3
"""Auto-diacritize the Riyad al-Salihin hadiths that tashkeel transfer
(transfer_tashkeel.mjs) didn't match, using CATT (Character-based Arabic
Tashkeel Transformer, abjadai/catt — state-of-the-art, DER ~2.9%).

Writes into matn.diacritized + matn.diacritizationSource, same non-destructive
shape as the transfer script; matn.arabic (the ingested, immutable text) is
never touched. Per project-owner decision (2026-08-15, mirrors the source-
content bulk-approval), CATT output ships without a per-hadith reviewer gate.

Requires the eval venv: source .cache/eval-venv/bin/activate
Usage (from repo root): python3 pipeline/diacritize/auto_diacritize_catt.py
"""

import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from catt_tashkeel import CATTEncoderDecoder

RIYAD_DIR = Path("content/books/riyad_assalihin/hadith")
DIACRITICS = re.compile(r"[ً-ٰـ]")


def main():
    files = sorted(RIYAD_DIR.glob("*.json"))
    print("loading CATT encoder-decoder model...")
    model = CATTEncoderDecoder()
    print("loaded.\n")

    done, skipped, failed = 0, 0, 0
    for i, fp in enumerate(files):
        doc = json.loads(fp.read_text())
        if doc["matn"].get("diacritized"):
            skipped += 1
            continue
        stripped = DIACRITICS.sub("", doc["matn"]["arabic"])
        try:
            predicted = model.do_tashkeel(stripped, verbose=False)
        except Exception as e:
            print(f"  FAILED {fp.name}: {e}", file=sys.stderr)
            failed += 1
            continue
        doc["matn"]["diacritized"] = predicted
        doc["matn"]["diacritizationSource"] = {
            "method": "catt-auto",
            "model": "abjadai/catt (encoder-decoder)",
        }
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        done += 1
        if done % 100 == 0:
            print(f"progress: {done} diacritized ({i + 1}/{len(files)} scanned)")

    print("\n--- CATT auto-diacritization report ---")
    print(f"diacritized: {done}")
    print(f"already had a transfer (skipped): {skipped}")
    print(f"failed: {failed}")


if __name__ == "__main__":
    main()
