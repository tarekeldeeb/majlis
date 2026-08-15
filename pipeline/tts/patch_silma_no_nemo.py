#!/usr/bin/env python3
"""Patch an installed silma-tts package to defer its nemo_text_processing
import, so SilmaTTS(enable_normalizer=False) works without pynini installed.

Why this is safe: nemo_text_processing is only used for generic number/date
verbalization. Majlis's hadith matn is always pre-diacritized classical Arabic
prose with no digits to expand, and utils_infer.py's own auto-tashkeel logic
already skips re-diacritizing text that has tashkeel — so this dependency is
provably unused on our input, not "worked around" at the cost of quality.
It's a real, documented pynini/OpenFST version incompatibility on this host
(pynini's C++ code calls fst::StringJoin, renamed to StrJoin in the OpenFST
available via Homebrew) — see docs/tts-evaluation.md.

Idempotent: safe to re-run against a freshly (re)installed silma-tts.
Usage (inside the venv, from repo root): python3 pipeline/tts/patch_silma_no_nemo.py
"""

import importlib.util
import sys

spec = importlib.util.find_spec("silma_tts.infer.utils_infer")
if spec is None or spec.origin is None:
    sys.exit("silma_tts not installed in the active environment")
path = spec.origin

src = open(path).read()

TOP_IMPORT = "from nemo_text_processing.text_normalization.normalize import Normalizer\nfrom catt_tashkeel import CATTEncoderOnly"
DEFERRED_IMPORT = (
    "# nemo_text_processing import deferred (majlis patch, pipeline/tts/patch_silma_no_nemo.py):\n"
    "# pynini has no working build on this host, and our pipeline never calls\n"
    "# normalize_text() since hadith matn is always pre-diacritized prose with\n"
    "# no digits to expand.\n"
    "from catt_tashkeel import CATTEncoderOnly"
)

FN_DEF = "def load_nemo_text_normalizer(text):\n    global nemo_ar_normalizer, nemo_en_normalizer"
FN_DEF_PATCHED = (
    "def load_nemo_text_normalizer(text):\n"
    "    from nemo_text_processing.text_normalization.normalize import Normalizer\n"
    "    global nemo_ar_normalizer, nemo_en_normalizer"
)

if DEFERRED_IMPORT in src:
    print(f"already patched: {path}")
    sys.exit(0)

if TOP_IMPORT not in src:
    sys.exit(
        f"import block not found in {path} - silma-tts version may have changed; "
        "inspect utils_infer.py manually and update this patch"
    )

src = src.replace(TOP_IMPORT, DEFERRED_IMPORT)
src = src.replace(FN_DEF, FN_DEF_PATCHED)
open(path, "w").write(src)
print(f"patched: {path}")
