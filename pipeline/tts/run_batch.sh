#!/bin/bash
# Run the SILMA TTS batch with the environment fixes documented in
# docs/tts-evaluation.md. All arguments pass through to generate_audio.py.
#
# Usage (from repo root):
#   bash pipeline/tts/run_batch.sh --book nawawi40
#   bash pipeline/tts/run_batch.sh --book all --nfe-step 8
set -euo pipefail
cd "$(dirname "$0")/../.."

VENV=.cache/eval-venv
if [ ! -x "$VENV/bin/python" ]; then
  echo "Missing $VENV. Run: bash pipeline/tts/setup_silma_local.sh" >&2
  exit 1
fi

export SSL_CERT_FILE="$("$VENV/bin/python" -c 'import certifi; print(certifi.where())')"
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:${DYLD_LIBRARY_PATH:-}"
# TTS must run entirely from the local model cache; no runtime hub requests.
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1

exec "$VENV/bin/python" -I pipeline/tts/generate_audio.py "$@"
