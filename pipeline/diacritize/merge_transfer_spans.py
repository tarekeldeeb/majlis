#!/usr/bin/env python3
"""Restore high-quality transfer diacritics inside the full-matn CATT text.

`rediacritize_transfer_full.py` replaced each transfer hadith's partial span
with full CATT output. This script takes the original transfer span from
git HEAD and merges its word-level diacritics back into the full CATT text,
keeping CATT only for the isnad prefix and takhrij suffix.

Usage (from repo root):
  python3 -I pipeline/diacritize/merge_transfer_spans.py [--dry-run] [--limit N]
"""

import argparse
import json
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"
DIACRITICS = re.compile(r"[ً-ْٰـ]")
NON_WORD = re.compile(r"[^ء-ي ]+")


def norm_words(text):
    return NON_WORD.sub(" ", DIACRITICS.sub("", text)).split()


def head_json(relpath):
    out = subprocess.check_output(["git", "show", f"HEAD:{relpath}"], cwd=ROOT)
    return json.loads(out)


def merge(doc, old):
    src = old.get("matn", {}).get("diacritizationSource", {})
    start, end = src.get("riyadWordStart"), src.get("riyadWordEnd")
    transfer = old.get("matn", {}).get("diacritized", "")
    if start is None or end is None or not transfer:
        return None, "no transfer span"
    orig_words = old["matn"]["arabic"].split()
    catt_words = doc["matn"]["diacritized"].split()
    transfer_words = transfer.split()
    if norm_words(" ".join(catt_words)) != norm_words(old["matn"]["arabic"]):
        return None, "CATT word sequence differs from original"
    mid = orig_words[start:end + 1]
    a = norm_words(" ".join(mid))
    normed, norm_to_raw = [], []
    for ridx, w in enumerate(transfer_words):
        for nw in norm_words(w):
            normed.append(nw)
            norm_to_raw.append(ridx)
    if not a or not normed:
        return None, "empty span"
    if a == normed:
        middle_out = list(transfer_words)
    else:
        sm = SequenceMatcher(None, a, normed, autojunk=False)
        middle_out = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag in ("equal", "replace"):
                raw_start = norm_to_raw[j1]
                raw_end = norm_to_raw[j2 - 1] + 1
                middle_out.extend(transfer_words[raw_start:raw_end])
            elif tag == "insert":
                if j2 > j1:
                    raw_start = norm_to_raw[j1]
                    raw_end = norm_to_raw[j2 - 1] + 1
                    for w in transfer_words[raw_start:raw_end]:
                        if not re.search(r"[ء-ي]", w):
                            middle_out.append(w)
            elif tag == "delete":
                middle_out.extend(catt_words[start + i1:start + i2])
    merged = catt_words[:start] + middle_out + catt_words[end + 1:]
    result = " ".join(merged)
    if norm_words(result) != norm_words(old["matn"]["arabic"]):
        return None, "merged sequence differs from original"
    return result, f"merged {len(middle_out)} words"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    merged = skipped = 0
    reasons = {}
    for fp in sorted(HADITH_DIR.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        src = doc.get("matn", {}).get("diacritizationSource", {})
        if src.get("method") != "catt-auto-full" or "previousTransfer" not in src:
            continue
        rel = fp.relative_to(ROOT).as_posix()
        old = head_json(rel)
        text, note = merge(doc, old)
        if text is None:
            skipped += 1
            reasons[note] = reasons.get(note, 0) + 1
            continue
        merged += 1
        if not args.dry_run:
            doc["matn"]["diacritized"] = text
            doc["matn"]["diacritizationSource"]["method"] = "transfer+catt-boundaries"
            fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if args.limit and merged >= args.limit:
            break
    print(f"merged: {merged}, skipped: {skipped}")
    for k, v in reasons.items():
        print(f"  {v}: {k}")


if __name__ == "__main__":
    main()
