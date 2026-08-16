#!/usr/bin/env python3
"""Diacritize the Riyad hadiths that auto_diacritize_catt.py couldn't handle:
CATT's encoder has a fixed positional-embedding limit (empirically ~1024)
and errors on longer inputs. These are all long hadiths (up to ~9300 chars)
that exceed it. Splits each on natural sentence boundaries into chunks under
the limit, diacritizes each chunk with CATT, and rejoins.

Same non-destructive shape as the other diacritize scripts; matn.arabic is
never touched. Per the same 2026-08-15 owner decision, ships without a
per-hadith review gate.

Requires the eval venv: source .cache/eval-venv/bin/activate
Usage (from repo root): python3 pipeline/diacritize/auto_diacritize_catt_long.py
"""

import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

from catt_tashkeel import CATTEncoderDecoder

RIYAD_DIR = Path("content/books/riyad_assalihin/hadith")
DIACRITICS = re.compile(r"[ً-ٰـ]")
MAX_CHUNK_CHARS = 800  # safety margin under CATT's ~1024-token limit

# Split after sentence-ending punctuation (Arabic full stop variants, periods)
# or, failing that, after commas - always keeping the delimiter attached.
SENTENCE_BOUNDARY = re.compile(r"(?<=[.۔؛،])\s+")


def chunk_text(text, max_chars=MAX_CHUNK_CHARS):
    if len(text) <= max_chars:
        return [text]
    pieces = SENTENCE_BOUNDARY.split(text)
    chunks, cur = [], ""
    for piece in pieces:
        candidate = (cur + " " + piece).strip() if cur else piece
        if len(candidate) <= max_chars:
            cur = candidate
        else:
            if cur:
                chunks.append(cur)
            # a single piece longer than max_chars: hard-split on whitespace
            if len(piece) > max_chars:
                words = piece.split(" ")
                cur = ""
                for w in words:
                    cand2 = (cur + " " + w).strip() if cur else w
                    if len(cand2) <= max_chars:
                        cur = cand2
                    else:
                        if cur:
                            chunks.append(cur)
                        cur = w
            else:
                cur = piece
    if cur:
        chunks.append(cur)
    return chunks


def main():
    files = sorted(RIYAD_DIR.glob("*.json"))
    print("loading CATT encoder-decoder model...")
    model = CATTEncoderDecoder()
    print("loaded.\n")

    done, skipped, failed = 0, 0, 0
    for fp in files:
        doc = json.loads(fp.read_text())
        if doc["matn"].get("diacritized"):
            skipped += 1
            continue
        stripped = DIACRITICS.sub("", doc["matn"]["arabic"])
        chunks = chunk_text(stripped)
        try:
            diacritized_chunks = [model.do_tashkeel(c, verbose=False) for c in chunks]
        except Exception as e:
            print(f"  FAILED {fp.name} ({len(stripped)} chars, {len(chunks)} chunks): {e}", file=sys.stderr)
            failed += 1
            continue
        predicted = " ".join(diacritized_chunks)
        doc["matn"]["diacritized"] = predicted
        doc["matn"]["diacritizationSource"] = {
            "method": "catt-auto-chunked",
            "model": "abjadai/catt (encoder-decoder)",
            "chunks": len(chunks),
        }
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        done += 1
        print(f"  ok {fp.name} ({len(stripped)} chars -> {len(chunks)} chunks)")

    print("\n--- CATT chunked auto-diacritization report ---")
    print(f"diacritized: {done}")
    print(f"already had a transfer (skipped): {skipped}")
    print(f"failed: {failed}")


if __name__ == "__main__":
    main()
