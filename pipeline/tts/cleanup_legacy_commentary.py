#!/usr/bin/env python3
"""Remove legacy unsplit `<NNN>-commentary.mp3` files once all three split
commentary segments exist for a hadith.

Dry-run by default; pass --apply to delete files and update the JSON.

Usage (from repo root):
  python3 -I pipeline/tts/cleanup_legacy_commentary.py --book nawawi40
  python3 -I pipeline/tts/cleanup_legacy_commentary.py --book all --apply
"""

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "content/books"
AUDIO = ROOT / "content/audio"
WIDTH = {"nawawi40": 3, "riyad_assalihin": 4}
PARTS = ("adab", "fawaid", "meaning")


def valid(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="all")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    books = ["nawawi40", "riyad_assalihin"] if args.book == "all" else [args.book]
    removed = 0
    for book in books:
        for fp in sorted((BOOKS / book / "hadith").glob("*.json")):
            doc = json.loads(fp.read_text(encoding="utf-8"))
            audio = doc.get("audio") or {}
            if not all(audio.get(k) and valid(AUDIO / audio[k]) for k in PARTS):
                continue
            legacy = audio.get("commentary")
            path = (
                AUDIO / legacy
                if legacy
                else AUDIO / book / f"{doc['number']:0{WIDTH.get(book, 3)}d}-commentary.mp3"
            )
            if not path.exists():
                continue
            print(f"{book}:{doc['number']} -> {'delete' if args.apply else 'would delete'} {path.name}")
            removed += 1
            if args.apply:
                rel = path.relative_to(ROOT)
                try:
                    subprocess.run(
                        ["git", "-C", str(ROOT), "rm", "--quiet", "--", str(rel)],
                        check=True,
                    )
                except subprocess.CalledProcessError:
                    path.unlink(missing_ok=True)
                audio.pop("commentary", None)
                doc["audio"] = audio
                fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{'removed' if args.apply else 'would remove'} {removed} legacy commentary file(s)")


if __name__ == "__main__":
    main()
