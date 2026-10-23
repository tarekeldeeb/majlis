#!/usr/bin/env python3
"""Convert or remove leftover TTS WAV files.

Safe to run while generation is active: files that are open or modified in the
last 10 minutes are treated as in-flight and skipped. For every stable WAV:
- if a non-empty MP3 already exists, remove the WAV;
- otherwise convert to MP3 with the production settings, verify duration, then
  remove the WAV.

Usage (from repo root):
  python3 -I pipeline/tts/sweep_wavs.py
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / "content/audio"
IN_FLIGHT_SECONDS = 600
FFMPEG_ARGS = [
    "-ac", "1", "-ar", "24000", "-b:a", "96k",
    "-af", "afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.02,areverse",
]


def duration(path: Path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def is_open(path: Path) -> bool:
    try:
        out = subprocess.run(["lsof", str(path)], capture_output=True, text=True)
        return bool(out.stdout.strip())
    except Exception:
        return False


def main():
    wavs = sorted(AUDIO.rglob("*.wav"))
    converted = removed = skipped = failed = 0
    now = time.time()
    for wav in wavs:
        if is_open(wav) or now - wav.stat().st_mtime < IN_FLIGHT_SECONDS:
            print(f"skip in-flight: {wav.relative_to(ROOT)}")
            skipped += 1
            continue
        mp3 = wav.with_suffix(".mp3")
        if mp3.exists() and mp3.stat().st_size:
            if duration(mp3) > 1:
                wav.unlink()
                print(f"removed (mp3 exists): {wav.relative_to(ROOT)}")
                removed += 1
                continue
        tmp = mp3.with_suffix(".tmp.mp3")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), *FFMPEG_ARGS, str(tmp)],
                check=True,
            )
            if abs(duration(wav) - duration(tmp)) > 1.0:
                raise ValueError("duration mismatch")
            tmp.replace(mp3)
            wav.unlink()
            print(f"converted: {wav.relative_to(ROOT)} -> {mp3.name}")
            converted += 1
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            print(f"FAILED {wav.relative_to(ROOT)}: {exc}", file=sys.stderr)
            failed += 1
    print(f"wav sweep: converted={converted} removed={removed} skipped={skipped} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
