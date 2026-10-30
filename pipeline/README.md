# Pipeline

Build-time stages; each stage reads/writes `content/` and is safe to re-run:

1. **ingest/** — `ingest_book.mjs <bookId>` fetches a book from its registered source and writes matn-only hadith files with chapter info (never overwrites existing files). `fetch_osamayy_refs.mjs` mirrors the public-domain Nawawi sharh; `parse_uthaymeen_sharh.py` parses the original Shamela cache; `build_riyad_refs_from_txt.py` recovers full Riyad reference coverage from the clean six-volume sharh TXT in `.cache/sharh/`.
1a. **review/** — `approve_all.mjs <bookId...>` bulk-approves source-derived content per the 2026-08-15 policy. Novel-commentary review is deferred (2026-10-22) — see `docs/review-workflow.md`.
2. **commentary/** — batch drafting of Riyad commentary:
   - `make_excerpts.py` writes capped drafting refs to `.cache/draft-refs/`.
   - `BATCH_INSTRUCTIONS.md` + `docs/commentary-style.md` define the draft contract.
   - `validate_batches.py <batch.json...>` checks every entry before applying.
   - `apply_riyad_batch.py <batch.json>` writes commentary into the hadith files and marks review as deferred.
   - `punctuate_commentary.py [--apply]` adds conservative clause commas to read-aloud commentary.
3. **diacritize/** — tashkeel transfer, CATT fallback, `rediacritize_transfer_full.py` (full-matn CATT for partial transfer spans), `qa_riyad.py` (structural QA + flag clearing), `diacritize_commentary.py` (only strings below the density threshold).
4. **tts/** — generate per-segment audio for `approved` hadiths with SILMA: number + matn in the male ClArTTS voice, and ādāb/fawāʾid/meaning in the male Arabic Speech Corpus voice. `run_batch.sh --book nawawi40` is resumable, writes HE-AAC 32 kbps clips (`pipeline/tts/audio_format.py`) to `content/audio/<book>/<NNN>-{number,matn,adab,fawaid,meaning}.m4a` plus shared `content/audio/titles/*.m4a`, and records the paths in each hadith's `audio` field. `synth.py` does punctuation-aware chunking (180 chars, with long narrator chains split at `بن`), 8 ms edge fades and a 20 ms crossfade to avoid SILMA's inter-chunk silence and clicks; Ādāb/Fawāʾid bullets get an explicit 0.8 s pause.
5. **package/** — bundle `approved` content + audio manifests into app assets; must exclude anything not approved.

Scripts are dependency-free Node ≥ 18 (`.mjs`) or Python 3 stdlib unless a stage needs the CATT/TTS eval venv (`.cache/eval-venv`).

```sh
node pipeline/ingest/ingest_book.mjs riyad_assalihin       # from the repo root
python3 -I pipeline/commentary/make_excerpts.py
python3 -I pipeline/commentary/validate_batches.py pipeline/commentary/batches/*.json
python3 -I pipeline/commentary/apply_riyad_batch.py pipeline/commentary/batches/<batch>.json
```

## Narrating a whole book (macOS, or Ubuntu with an NVIDIA GPU)

Clips are HE-AAC 32 kbps `.m4a` (`tts/audio_format.py`): Apple's encoder on macOS, Fraunhofer FDK on Linux. SILMA runs on CUDA or Apple's GPU automatically.

```bash
# Ubuntu 22.04 (one time)
sudo add-apt-repository -y multiverse && sudo apt update
sudo apt install -y git git-lfs ffmpeg fdkaac python3-venv && git lfs install
# macOS (one time): brew install git-lfs ffmpeg && git lfs install

git clone git@github.com:tarekeldeeb/majlis.git && cd majlis
bash pipeline/tts/setup_silma_local.sh     # Python env, encoder check, models (needs internet once)

# Run to completion: stays awake, restarts after a crash, resumes from the first missing clip.
bash pipeline/tts/run_until_done.sh --book riyad_assalihin --stt-check --skip-titles
tail -f ~/majlis-tts.log                    # progress: [hadith/total] lines with an ETA
```

Each clip lands in `content/audio/<book>/` and in its hadith's `audio` field as soon as it exists, so nothing is lost if the machine stops: run the same command again. To save progress to GitHub without triggering a web deploy:

```bash
git add content/audio/riyad_assalihin content/books/riyad_assalihin/hadith
git commit -m "Narrate Riyad al-Salihin (in progress) [skip ci]" && git push
```
