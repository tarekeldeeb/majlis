#!/usr/bin/env python3
"""Apply a batch of drafted commentary (adab/fawaid/meaning/relatedAyat/sources)
to Riyad al-Salihin hadith files, by hadith number. Batch file: JSON object
keyed by hadith number (string) -> commentary object, same shape as
content/books/*/hadith/*.json's "commentary" field.

Sets review.status to "approved" for pipeline/TTS purposes only. Review of
novel commentary is deferred by project-owner decision (2026-10-22); files
carry reviewers: [] and reviewPolicy: "deferred" so no unperformed review is
attributed. Public release still requires both reviewers' sign-off.

Usage (from repo root): python3 pipeline/commentary/apply_riyad_batch.py <batch.json>
"""

import json
import sys
from pathlib import Path
from datetime import date

RIYAD_DIR = Path("content/books/riyad_assalihin/hadith")


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: apply_riyad_batch.py <batch.json>")
    batch = json.loads(Path(sys.argv[1]).read_text())

    applied, skipped = 0, 0
    for num_str, commentary in batch.items():
        num = int(num_str)
        fp = RIYAD_DIR / f"{num:04d}.json"
        if not fp.exists():
            print(f"  MISSING hadith file for {num}: {fp}", file=sys.stderr)
            skipped += 1
            continue
        doc = json.loads(fp.read_text())
        if doc["commentary"].get("fawaid"):
            print(f"  already has commentary, skipping: {num}")
            skipped += 1
            continue
        doc["commentary"] = commentary
        doc["review"] = {
            "status": "approved",
            "reviewers": [],
            "reviewPolicy": "deferred",
            "approvedAt": date.today().isoformat(),
        }
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        applied += 1

    print(f"\napplied: {applied}, skipped: {skipped}")


if __name__ == "__main__":
    main()
