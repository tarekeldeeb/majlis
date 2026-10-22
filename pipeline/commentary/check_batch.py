#!/usr/bin/env python3
"""Check a batch's keys against the manifest assignment.

Usage (from repo root): python3 -I pipeline/commentary/check_batch.py riyad-001
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "pipeline/commentary/batches/manifest.json"
BATCH_DIR = ROOT / "pipeline/commentary/batches"


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: check_batch.py <batch-id>")
    bid = sys.argv[1]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entry = next((b for b in manifest["batches"] if b["id"] == bid), None)
    if entry is None:
        sys.exit(f"unknown batch {bid}")
    fp = BATCH_DIR / f"{bid}.json"
    if not fp.exists():
        sys.exit(f"missing {fp}")
    data = json.loads(fp.read_text(encoding="utf-8"))
    expected = {str(n) for n in entry["numbers"]}
    actual = set(data)
    missing = expected - actual
    extra = actual - expected
    print(f"{bid}: expected {len(expected)}, actual {len(actual)}, missing {len(missing)}, extra {len(extra)}")
    if missing:
        print("  missing:", sorted(int(x) for x in missing)[:20])
    if extra:
        print("  extra:", sorted(int(x) for x in extra)[:20])
    sys.exit(1 if missing or extra else 0)


if __name__ == "__main__":
    main()
