# Pipeline

Build-time stages; each stage reads/writes `content/` and is safe to re-run:

1. **ingest/** — `ingest_book.mjs <bookId>` fetches a book from its registered source and writes matn-only hadith files with chapter info (never overwrites existing files). `fetch_osamayy_refs.mjs` mirrors the public-domain Nawawi sharh; `parse_uthaymeen_sharh.py` parses the original Shamela cache; `build_riyad_refs_from_txt.py` recovers full Riyad reference coverage from the clean six-volume sharh TXT in `.cache/sharh/`.
1a. **review/** — `approve_all.mjs <bookId...>` bulk-approves source-derived content per the 2026-08-15 policy. Novel-commentary review is deferred (2026-10-22) — see `docs/review-workflow.md`.
2. **commentary/** — batch drafting of Riyad commentary:
   - `make_excerpts.py` writes capped drafting refs to `.cache/draft-refs/`.
   - `BATCH_INSTRUCTIONS.md` + `docs/commentary-style.md` define the draft contract.
   - `validate_batches.py <batch.json...>` checks every entry before applying.
   - `apply_riyad_batch.py <batch.json>` writes commentary into the hadith files and marks review as deferred.
3. **diacritize/** — tashkeel transfer, CATT fallback, `rediacritize_transfer_full.py` (full-matn CATT for partial transfer spans), `qa_riyad.py` (structural QA + flag clearing), `diacritize_commentary.py` (only strings below the density threshold).
4. **tts/** — generate audio for `approved` hadiths only (engine chosen via `docs/tts-evaluation.md`).
5. **package/** — bundle `approved` content + audio manifests into app assets; must exclude anything not approved.

Scripts are dependency-free Node ≥ 18 (`.mjs`) or Python 3 stdlib unless a stage needs the CATT/TTS eval venv (`.cache/eval-venv`).

```sh
node pipeline/ingest/ingest_book.mjs riyad_assalihin       # from the repo root
python3 -I pipeline/commentary/make_excerpts.py
python3 -I pipeline/commentary/validate_batches.py pipeline/commentary/batches/*.json
python3 -I pipeline/commentary/apply_riyad_batch.py pipeline/commentary/batches/<batch>.json
```
