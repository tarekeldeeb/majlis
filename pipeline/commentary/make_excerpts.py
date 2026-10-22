#!/usr/bin/env python3
"""Create small drafting excerpts of Riyad refs (keeps agent token use bounded).

Writes `.cache/draft-refs/NNNN.md` with the source header, a capped matn
section, and the first ~4,000 characters of the sharh. The full refs remain
the archival copies under content/references/.

Usage (from repo root): python3 -I pipeline/commentary/make_excerpts.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF_DIR = ROOT / "content/references/riyad_assalihin"
OUT_DIR = ROOT / ".cache/draft-refs"
MAX_MATN = 1200
MAX_SHARH = 4000


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    written = 0
    for fp in sorted(REF_DIR.glob("*.md")):
        text = fp.read_text(encoding="utf-8")
        head, sep, rest = text.partition("## المتن كما في الشرح")
        if not sep:
            out = text[: MAX_MATN + MAX_SHARH]
        else:
            matn, sep2, sharh = rest.partition("## الشرح")
            matn = matn.strip()[:MAX_MATN]
            sharh = sharh.strip()[:MAX_SHARH]
            out = (
                head.rstrip()
                + "\n\n## المتن كما في الشرح\n\n"
                + matn
                + "\n\n## الشرح\n\n"
                + sharh
                + "\n"
            )
        (OUT_DIR / fp.name).write_text(out, encoding="utf-8")
        total += len(out)
        written += 1
    print(f"excerpts: {written}, total bytes: {total}, avg: {total // max(1, written)}")


if __name__ == "__main__":
    main()
