#!/usr/bin/env python3
"""Convert or remove leftover TTS WAV files.

Safe to run while generation is active: files that are open or modified in the
last 10 minutes are treated as in-flight and skipped. For every stable WAV:
- if a non-empty clip already exists, remove the WAV;
- otherwise encode it with the production settings (audio_format), verify
  duration, then remove the WAV.

Usage (from repo root):
  python3 -I pipeline/tts/sweep_wavs.py
"""

import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audio_format import AUDIO_EXT, ENCODE  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / "content/audio"
IN_FLIGHT_SECONDS = 600
FFMPEG_ARGS = ["-nostdin", "-threads", "1", *ENCODE, "-af", "afade=t=in:st=0:d=0.02"]


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
        clip = wav.with_suffix(AUDIO_EXT)
        if clip.exists() and clip.stat().st_size:
            if duration(clip) > 1:
                wav.unlink()
                print(f"removed (clip exists): {wav.relative_to(ROOT)}")
                removed += 1
                continue
        tmp = clip.with_suffix(".tmp" + AUDIO_EXT)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), *FFMPEG_ARGS, str(tmp)],
                check=True,
            )
            if abs(duration(wav) - duration(tmp)) > 1.0:
                raise ValueError("duration mismatch")
            tmp.replace(clip)
            wav.unlink()
            print(f"converted: {wav.relative_to(ROOT)} -> {clip.name}")
            converted += 1
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            print(f"FAILED {wav.relative_to(ROOT)}: {exc}", file=sys.stderr)
            failed += 1
    print(f"wav sweep: converted={converted} removed={removed} skipped={skipped} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
