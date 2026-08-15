#!/bin/bash
# Set up a local, self-hosted SILMA TTS v1 environment (no dependency on the
# shared hosted demo, which can't handle batch-generating ~2000 hadiths).
# Solves three real, understood host issues rather than working around them
# blindly - see docs/tts-evaluation.md for the story on each:
#   1. Python-on-macOS has no CA bundle -> use certifi's.
#   2. silma-tts declares nemo_text_processing==1.1.0, which needs pynini,
#      which needs an OpenFST C++ API renamed in the version available here.
#      That dependency is provably unused for our always-pre-diacritized
#      input (see patch_silma_no_nemo.py) - deferred via a local patch
#      instead of fighting the native build.
#   3. torchaudio's default backend now needs torchcodec, which needs
#      FFmpeg's shared libraries at runtime (not just build time).
#
# Usage (from repo root): bash pipeline/tts/setup_silma_local.sh
set -euo pipefail

VENV=.cache/eval-venv

command -v brew >/dev/null || { echo "Homebrew required (for ffmpeg)."; exit 1; }
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg

python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --quiet --upgrade pip certifi

# catt-tashkeel declares onnxruntime-gpu (CUDA-only, no macOS build) but the
# CPU onnxruntime package provides the same importable module.
pip install --quiet --no-deps catt-tashkeel==1.0.2
pip install --quiet onnxruntime numpy tqdm huggingface_hub transformers

# silma-tts declares nemo_text_processing==1.1.0 (pynini, see above) - install
# everything else it needs and skip that one.
pip install --quiet --no-deps silma-tts
pip install --quiet \
  cached_path click "ema_pytorch>=0.5.2" gradio "hydra-core>=1.3.0" librosa \
  matplotlib "numpy<=1.26.4" pydub safetensors soundfile tomli \
  "torch>=2.0.0" "torchaudio>=2.0.0" "torchvision>=0.21" torchdiffeq \
  "tqdm>=4.65.0" transformers transformers_stream_generator unidecode vocos \
  "x_transformers>=1.31.14" torchcodec

python3 "$(dirname "$0")/patch_silma_no_nemo.py"

echo ""
echo "Setup done. Before running any script that uses SilmaTTS, in this shell:"
echo "  source $VENV/bin/activate"
echo "  export SSL_CERT_FILE=\$(python3 -c 'import certifi; print(certifi.where())')"
echo "  export DYLD_LIBRARY_PATH=\"/opt/homebrew/lib:\$DYLD_LIBRARY_PATH\""
echo "Instantiate with SilmaTTS(enable_normalizer=False) and call"
echo ".infer(..., normalize_numbers=False) to avoid the nemo code path entirely."
