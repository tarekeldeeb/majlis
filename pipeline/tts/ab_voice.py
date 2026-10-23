#!/usr/bin/env python3
"""Generate one text through several reference voices for A/B listening.

Reads every `<name>.wav` with a matching `<name>.txt` in --ref-dir, runs SILMA
once per reference, and writes WAV + MP3 to --out-dir.

Run with the eval venv:
  .cache/eval-venv/bin/python -I pipeline/tts/ab_voice.py
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from silma_tts.api import SilmaTTS

ROOT = Path(__file__).resolve().parents[2]


def to_mp3(wav, mp3):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "24000", "-b:a", "96k", str(mp3)],
        check=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text-file", default="")
    ap.add_argument("--ref-dir", default=str(ROOT / ".cache/tts-refs"))
    ap.add_argument("--out-dir", default=str(ROOT / ".cache/tts-refs/ab"))
    ap.add_argument("--nfe-step", type=int, default=16)
    ap.add_argument("--speed", type=float, default=1.0)
    args = ap.parse_args()

    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8").strip()
    else:
        doc = json.loads((ROOT / "content/books/nawawi40/hadith/001.json").read_text())
        text = doc["matn"].get("diacritized") or doc["matn"]["arabic"]

    ref_dir = Path(args.ref_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    refs = []
    for wav in sorted(ref_dir.glob("*.wav")):
        txt = wav.with_suffix(".txt")
        if txt.exists():
            refs.append((wav.stem, wav, txt.read_text(encoding="utf-8").strip()))
    if not refs:
        sys.exit(f"no .wav/.txt pairs in {ref_dir}")

    print(f"text: {len(text.split())} words; references: {len(refs)}", flush=True)
    print("loading SILMA...", flush=True)
    tts = SilmaTTS(enable_normalizer=False)

    for name, wav, ref_text in refs:
        t = time.perf_counter()
        out_wav = out_dir / f"{name}.wav"
        tts.infer(
            ref_file=str(wav),
            ref_text=ref_text,
            gen_text=text,
            file_wave=str(out_wav),
            normalize_numbers=False,
            force_tashkeel=False,
            nfe_step=args.nfe_step,
            speed=args.speed,
        )
        out_mp3 = out_dir / f"{name}.mp3"
        to_mp3(out_wav, out_mp3)
        dur = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(out_mp3)]
        ).decode().strip()
        print(f"{name}: {time.perf_counter()-t:.1f}s wall, {dur}s audio -> {out_mp3}", flush=True)


if __name__ == "__main__":
    main()
