#!/usr/bin/env python3
"""Delete the clips whose text changed since a git revision, so that the next batch run
narrates exactly those again (it only fills in missing clips).

A clip is stale when the text it reads changed: the matn's reading text
(matn.diacritized, else matn.arabic) for the matn clip, and the commentary parts for
theirs. Dry run by default; --delete removes the files.

    python3 pipeline/tts/drop_stale_clips.py --book riyad_assalihin --since 3e53e70
    python3 pipeline/tts/drop_stale_clips.py --book riyad_assalihin --since 3e53e70 --delete
    bash pipeline/tts/run_until_done.sh --book riyad_assalihin --stt-check --skip-titles
"""

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def texts(doc):
    """What each clip reads, as stored in the hadith file."""
    c = doc.get("commentary") or {}
    return {
        "matn": doc["matn"].get("diacritized") or doc["matn"]["arabic"],
        "adab": c.get("adab") or [],
        "fawaid": c.get("fawaid") or [],
        "meaning": c.get("meaning") or "",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", required=True)
    ap.add_argument("--since", required=True, help="git revision the clips were narrated from")
    ap.add_argument("--delete", action="store_true")
    args = ap.parse_args()

    hadith_dir = f"content/books/{args.book}/hadith"
    changed = subprocess.run(["git", "diff", "--name-only", args.since, "--", hadith_dir],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    stale = []
    for rel in changed:
        path = ROOT / rel
        if not path.exists():
            continue
        old = subprocess.run(["git", "show", f"{args.since}:{rel}"], cwd=ROOT, capture_output=True, text=True)
        if old.returncode != 0:
            continue
        before, doc = texts(json.loads(old.stdout)), json.loads(path.read_text(encoding="utf-8"))
        after = texts(doc)
        for kind in after:
            clip = (doc.get("audio") or {}).get(kind)
            if clip and before[kind] != after[kind] and (ROOT / "content/audio" / clip).exists():
                stale.append(ROOT / "content/audio" / clip)

    for clip in stale:
        print(clip.relative_to(ROOT))
        if args.delete:
            clip.unlink()
    print(f"{len(stale)} clip(s) {'deleted' if args.delete else 'to narrate again (dry run; add --delete)'}")


if __name__ == "__main__":
    main()
