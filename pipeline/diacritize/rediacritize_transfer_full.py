#!/usr/bin/env python3
"""Re-diacritize the full matn of transfer-based Riyad hadiths.

The 2026-08-15 tashkeel transfer stored only the matched span in
`matn.diacritized`, leaving the isnad prefix and takhrij suffix
undiacritized. TTS needs the complete matn. This script runs CATT over the
full `matn.arabic` text, preserving punctuation and ﷺ exactly, replaces
`matn.diacritized`, and preserves the old transfer provenance under
`diacritizationSource.previousTransfer`.

Run with the eval venv:
  .cache/eval-venv/bin/python -I pipeline/diacritize/rediacritize_transfer_full.py

The immutable `matn.arabic` is never modified.
"""

import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from catt_tashkeel import CATTEncoderDecoder
sys.path.insert(0, str(Path(__file__).resolve().parent))
from catt_preserve import collect, rebuild, strip_diacritics

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"


def main():
    files = []
    for fp in sorted(HADITH_DIR.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        src = doc.get("matn", {}).get("diacritizationSource", {})
        if src.get("method") and not src.get("previousTransfer"):
            continue
        files.append((fp, doc))
    print(f"transfer hadiths: {len(files)}", file=sys.stderr)
    if not files:
        return

    texts = [strip_diacritics(doc["matn"]["arabic"]) for _, doc in files]
    jobs, plan = collect(texts)
    print(f"chunks: {len(jobs)}; loading CATT...", file=sys.stderr)
    model = CATTEncoderDecoder()
    outputs = model.do_tashkeel_batch(jobs, batch_size=16, verbose=False)
    print("diacritized chunks; writing...", file=sys.stderr)

    done = 0
    for i, (fp, doc) in enumerate(files):
        full = re.sub(r"[ \t]+", " ", rebuild(plan, outputs, i)).strip()
        old = doc["matn"].get("diacritizationSource", {})
        transfer = old.get("previousTransfer", old)
        doc["matn"]["diacritized"] = full
        doc["matn"]["diacritizationSource"] = {
            "method": "catt-auto-full",
            "model": "abjadai/catt (encoder-decoder)",
            "previousTransfer": {k: v for k, v in transfer.items() if k not in ("qa", "previousTransfer")},
        }
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done += 1
        if done % 100 == 0:
            print(f"  written {done}/{len(files)}", file=sys.stderr)
    print(f"done: {done}")


if __name__ == "__main__":
    main()
