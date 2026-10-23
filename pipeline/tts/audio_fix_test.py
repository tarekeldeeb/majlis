#!/usr/bin/env python3
"""A/B test SILMA chunking/crossfade fixes on hadith 001.

Variants:
  v1: default 120-char chunker, crossfade 0.12, speed 1.0
  v2: sentence-aware 180-char chunker (no comma/colon splits), crossfade 0.12
  v3: v2 + speed 0.85 (slower, more articulation)
  v4: whole text as one chunk (tests the model's text limit)

Run with the eval venv:
  .cache/eval-venv/bin/python -I pipeline/tts/audio_fix_test.py
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from silma_tts.api import SilmaTTS
import silma_tts.infer.utils_infer as ui

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".cache/tts-refs/fix"
REF_AUDIO = ROOT / "pipeline/tts/voices/clartts107.wav"
REF_TEXT = "أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ شَرُّ مَا أُعْطِيَ الْعَبْدُ"

BIDI = re.compile(r"[‎‏‪-‮⁦-⁩]")
SENT = re.compile(r"(?<=[.!?؛])\s+")


def tts_text(text):
    s = text.replace("ﷺ", "صلى الله عليه وسلم")
    s = BIDI.sub("", s)
    s = re.sub(r"\([0-9٠-٩۰-۹]+\)", " ", s)
    s = re.sub(r"(?<=\s)[0-9٠-٩۰-۹]+(?=[\s.)،]|$)", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s and s[-1] not in ".!؟؛":
        s += "."
    return s


def chunk_sentence(text, max_chars=120, limit=180):
    sentences = [s.strip() for s in SENT.split(text) if s.strip()]
    chunks, cur = [], ""
    for s in sentences:
        if not cur:
            cur = s
        elif len(cur) + 1 + len(s) <= limit:
            cur += " " + s
        else:
            chunks.append(cur)
            cur = s
        while len(cur) > limit:
            cut = cur.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            chunks.append(cur[:cut].strip())
            cur = cur[cut:].strip()
    if cur:
        chunks.append(cur)
    return chunks


def chunk_whole(text, max_chars=120, limit=100000):
    return [text.strip()]


def to_mp3(wav, mp3):
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
            "-ac", "1", "-ar", "24000", "-b:a", "96k",
            "-af", "afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.02,areverse",
            str(mp3),
        ],
        check=True,
    )


def main():
    doc = json.loads((ROOT / "content/books/nawawi40/hadith/001.json").read_text())
    text = tts_text(doc["matn"].get("diacritized") or doc["matn"]["arabic"])
    OUT.mkdir(parents=True, exist_ok=True)
    original = ui.chunk_text
    print(f"text: {len(text.split())} words", flush=True)
    tts = SilmaTTS(enable_normalizer=False)

    variants = [
        ("v1-crossfade120", original, 0.12, 1.0),
        ("v2-chunk180", chunk_sentence, 0.12, 1.0),
        ("v3-chunk180-slow", chunk_sentence, 0.12, 0.85),
        ("v4-whole", chunk_whole, 0.12, 1.0),
    ]
    for name, chunker, fade, speed in variants:
        ui.chunk_text = chunker
        chunks = chunker(text, 120)
        print(f"\n{name}: {len(chunks)} chunk(s), speed={speed}", flush=True)
        for i, c in enumerate(chunks):
            print(f"  {i} ({len(c)}): {c[:160]}", flush=True)
        wav = OUT / f"{name}.wav"
        t = time.perf_counter()
        tts.infer(
            ref_file=str(REF_AUDIO),
            ref_text=REF_TEXT,
            gen_text=text,
            file_wave=str(wav),
            normalize_numbers=False,
            force_tashkeel=False,
            nfe_step=16,
            speed=speed,
            cross_fade_duration=fade,
        )
        mp3 = OUT / f"{name}.mp3"
        to_mp3(wav, mp3)
        dur = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(mp3)]
        ).decode().strip()
        print(f"{name}: {time.perf_counter()-t:.1f}s wall, {dur}s audio -> {mp3}", flush=True)
    ui.chunk_text = original


if __name__ == "__main__":
    main()
