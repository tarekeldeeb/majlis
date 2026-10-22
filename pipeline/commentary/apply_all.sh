#!/bin/sh
# Validate and apply every Riyad commentary batch, then audit the corpus.
set -eu
cd "$(dirname "$0")/../.."

BATCHES=$(find pipeline/commentary/batches -maxdepth 1 -name '*.json' ! -name 'manifest.json' | sort)
python3 -I pipeline/commentary/validate_batches.py $BATCHES

for f in $BATCHES; do
  echo "== $f"
  python3 -I pipeline/commentary/apply_riyad_batch.py "$f"
done

python3 -I pipeline/commentary/audit_content.py
