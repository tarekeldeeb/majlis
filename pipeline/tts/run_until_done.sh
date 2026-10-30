#!/bin/bash
# Run a long TTS job to completion on a Mac: keep the machine awake, restart the
# generator whenever it stops on an error (a crash, running out of memory), and
# log everything. The generator resumes from the first missing clip, so a
# restart loses at most the clip being made. Arguments pass to run_batch.sh.
#
# Usage (from repo root):
#   bash pipeline/tts/run_until_done.sh --book riyad_assalihin --stt-check --skip-titles
# Log: ~/majlis-tts.log (override with MAJLIS_TTS_LOG). Stop with Ctrl-C.
set -uo pipefail
cd "$(dirname "$0")/../.."

LOG="${MAJLIS_TTS_LOG:-$HOME/majlis-tts.log}"
echo "logging to $LOG"
caffeinate -is bash -c '
  until bash pipeline/tts/run_batch.sh "$@"; do
    echo "generator stopped (exit $?); restarting in 60 s (Ctrl-C to stop)"
    sleep 60
  done' _ "$@" 2>&1 | tee -a "$LOG"
