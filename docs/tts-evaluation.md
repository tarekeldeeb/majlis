# TTS evaluation (Phase 0)

Goal: choose one open/free TTS able to read **fully diacritized classical Arabic** naturally. All audio is pre-generated at build time and QA'd file-by-file, so inference speed matters less than quality and license.

## Candidates

| Model | License | Notes |
|---|---|---|
| **Habibi** (2026) | open-source release — verify weights license | Recent unified-dialectal Arabic model; paper reports quality beating commercial TTS. Strongest candidate on paper. |
| **ClArTTS-trained VITS/FastPitch** | corpus free for research — check weight licenses | Corpus is specifically *Classical* Arabic with full tashkeel — exactly our register. |
| **Piper** (`ar_JO-kareem`) | MIT | Truly free, runs anywhere, low resource; quality is modest — acceptable fallback, not the goal. |
| **Meta MMS-TTS (ara)** | CC-BY-**NC** weights | Non-commercial clause: likely acceptable for a free app but restricts downstream reuse — treat as last resort and get consensus first. |
| **Coqui XTTS-v2** | CPML (**non-commercial**) | License conflicts with the strictly-open principle; excluded unless relicensed. |

## Diacritization — complete (2026-08-16)

All 1,896 Riyad al-Salihin hadiths are now diacritized: 558 via tashkeel-transfer (sourced from the 9-books collections), 1,299 via direct CATT, and the final 39 long hadiths (which exceeded CATT's ~1024-token encoder limit) via `pipeline/diacritize/auto_diacritize_catt_long.py` — split on sentence boundaries into sub-800-char chunks, diacritized individually, rejoined. Combined with the 42 in-source-diacritized Nawawi hadiths, the full 1,938-hadith corpus is TTS-ready.

**Correction (2026-10-22):** the tashkeel-transfer pass stored only the matched span in `matn.diacritized`, so its isnad prefix and takhrij suffix were missing from the TTS text. `pipeline/diacritize/rediacritize_transfer_full.py` now generates a full-matn CATT base for all 558 transfer hadiths, and `merge_transfer_spans.py` restores the original transfer diacritics word-by-word inside it, leaving CATT only at the boundaries. `qa_riyad.py` checks letter coverage and diacritic density; current QA passes 1,887/1,896, with the remaining 9 carrying source digits only.

**Nawawi gaps (2026-10-28):** the in-source Nawawi diacritics had gaps, mostly a bare «صلى الله عليه وسلم», «اللهُ» without its shadda, and missing case endings. `pipeline/diacritize/complete_diacritics.py` copies CATT's marks onto bare letters only, never replacing a source mark (nor adding CATT's fatha on a waṣla alef or a sukun on a long vowel), and writes the result to `matn.diacritized`; commentary is completed in place. Every changed word is listed in `content/books/nawawi40/diacritization-fill.json` for review.

**Riyad gaps (2026-10-30):** the same fill completed 5,729 words in 739 Riyad texts (punctuation-aware alignment, so words glued across «:»/«،» line up). It also exposed 70 matns where the 2026-10-22 CATT run had drifted («صٍدوَرهٍم», «فْنَعَمْ»); those were rebuilt from `matn.arabic` in 300-character chunks. Words CATT leaves bare by habit are written in their one correct form: the honorific «صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ», «لَا», «قَالَ». `content/books/riyad_assalihin/diacritization-fill.json` lists all of it for review; `qa_riyad.py` passes 1,896/1,896.

## Method

1. Test set: hadith 001 matn + its approved commentary (contrasting registers: narration vs. explanation).
2. Generate with each candidate at default settings (`pipeline/tts/`, one script per engine).
3. Both reviewers rate blind, 1–5 on: tashkeel fidelity (letter-level correctness), naturalness, suitability of tone for religious text.
4. Decision recorded here with sample files kept in `content/audio/eval/` (gitignored; upload to the CDN eval folder).

## Constraints

- Input text must be fully diacritized. 40 Nawawi is already diacritized in-source. For رياض الصالحين (largely undiacritized), the plan is **tashkeel transfer**: match each hadith back to its origin in the fully diacritized 9-books collections of the same hadith-json repo (Bukhari measured at ~88% diacritic density) guided by the embedded takhrīj, align the normalized text, and copy the diacritics over. Fallback for unmatched/adapted wording: an open automatic diacritizer (e.g. CAMeL Tools / CATT), with low-confidence hadiths flagged for reviewer spot-checks. Checked and ruled out: دليل الفالحين's machine-readable edition (Shamela #140) is undiacritized (~0.1% density) — it serves as commentary grounding only.

**Tashkeel transfer — results (run 2026-08-15, `pipeline/diacritize/`):** word-level longest-common-run matching against all 9 collections (64,975-token index) transferred diacritics for **558 / 1,896 hadiths (29%)**, average matched-span coverage 70% (range 55–94%), stored non-destructively in `matn.diacritized` + `matn.diacritizationSource` (never overwrites the immutable `matn.arabic`). Breakdown: bukhari 201, muslim 239, tirmidhi 62, abudawud 51, nasai 3, ibnmajah 2.
Root cause of the ceiling (confirmed by sampling — every hadith had *some* candidate, but most below the 55% coverage threshold): Imam Nawawi frequently **paraphrases/abridges** when compiling Riyad rather than quoting verbatim, and some of his citations are outside these 9 collections (Ibn Ḥibbān, al-Ḥākim, al-Adab al-Mufrad, etc.), which we don't have diacritized. This is a genuine ceiling for pure substring matching, not a bug — a non-contiguous (order-preserving) alignment could likely raise the match rate somewhat but was not pursued further this session. The remaining 1,338 hadiths route through the automatic-diacritizer fallback as originally planned.

**Auto-diacritizer fallback — first candidate rejected (checked 2026-08-15): Mishkal.** Installed (MIT-licensed, pure rule-based, `pip install mishkal`, fully offline — fits the strictly-open/free constraint on paper). Benchmarked by stripping diacritics from five already-verified nawawi40 hadiths and re-diacritizing, comparing against the known-correct text:

| Truth | Mishkal output | Problem |
|---|---|---|
| رَضِيَ اللهُ | رَضِّيَّ الْلَّهُ | invalid diacritic stacking, not a real word form |
| سَمِعْتُ (1st person) | سَمِعَتْ | wrong grammatical person |
| الْخَطَّابِ | الْخِطَابُ | different word entirely |
| قَالَ: سَمِعْتُ | قَالَسَمِعَتْ | dropped space/punctuation at the colon |

**Verdict: not acceptable for unsupervised use on scripture meant to be read aloud** — rejected as a ship-ready solution. It could still serve as a rough first-pass draft for human correction, but that isn't materially faster than a reviewer diacritizing from scratch. Next candidates to evaluate: CAMeL Tools (BERT-based disambiguation, heavier install, likely much higher accuracy) or a dedicated diacritization model (e.g. Shakkelha, a fine-tuned transformer). This blocks TTS for the 1,338 unmatched Riyad hadiths until resolved; the 558 tashkeel-transferred + all 42 Nawawi hadiths are unaffected and can proceed to the TTS bake-off now.

## Bake-off — pipeline feasibility check (2026-08-15)

**Piper (`ar_JO-kareem-medium`, MIT, fully offline, ~63 MB model):** confirmed the technical pipeline works end-to-end — installed via `pip install piper-tts`, synthesized hadith 001's full diacritized matn to a valid 22.05kHz mono WAV (53s, no errors). Sample kept at `.cache/tts-eval/hadith001_piper.wav` (gitignored, local only).

**Important limit on this check: I cannot listen to audio, so this confirms the pipeline runs — it is not a quality judgment.** Naturalness, correct pronunciation, and tone-appropriateness for scripture can only be assessed by a human listener. This is exactly why `docs/review-workflow.md`'s bake-off step requires both reviewers to rate samples blind — that step still needs to happen before any candidate is chosen. Habibi and ClArTTS-trained models remain unevaluated (Habibi in particular has no confirmed pip-installable inference path checked yet).

**SILMA TTS v1** (Apache-2.0, F5-TTS diffusion architecture, 150M params — the natural-sounding candidate meant to address Piper's robotic quality): local install hit a real wall — its `nemo_text_processing` dependency needs `pynini`, which needs OpenFST headers; installed OpenFST via Homebrew, but the pinned `pynini` version's C++ code calls an OpenFST API (`fst::StringJoin`) renamed in the OpenFST version available (`StrJoin`) — a genuine version incompatibility, not fixable by more include paths. Worked around it entirely by calling the hosted Space's Gradio API directly (`gradio_client`) instead of installing locally.

**First attempt was broken — real bug, now fixed.** SILMA is a voice-cloning model: it needs a reference audio + matching reference text to condition on. My first call passed a generic, unrelated placeholder audio (a stock Gradio test file) paired with Arabic reference text that audio doesn't actually say — the human reviewer (project owner) listened and correctly flagged the output as terrible. Root cause found by inspecting the Space's own repo: it ships a proper matched pair, `ar.ref.24k.wav` + the Arabic reference sentence. Re-ran with the correct pair — duration jumped from a garbled 12.5s to a proper **43s** (right in line with the expected ~35–45s for this 79-word text), confirming the first run's short output was a symptom of the broken reference, not a generation-length cap as I'd first guessed. Corrected sample: `.cache/tts-eval/hadith001_silma_v2.wav` (the broken `hadith001_silma.wav` is kept alongside it only as a "what mismatched conditioning does" reference, not a real candidate sample).

**Male voice attempt (rejected):** tried cloning a male voice in SILMA by using Piper's `ar_JO-kareem` output as the zero-shot reference clip (`hadith001_silma_male.wav`). Project owner listened and rejected it as terrible — bootstrapping a voice clone from a robotic synthetic source compounds the artifacts rather than fixing them. A real male voice option would need an intentionally recorded, clean reference clip, not a synthesized one.

## Decision (2026-08-15)

**TTS candidate: SILMA TTS v1.** The original 2026-08-15 decision used the bundled reference voice; that voice is now the A/B control only.

**2026-10-23 voice and segmentation update (owner-approved):**
- **Matn and hadith number:** ClArTTS male voice (`clartts107`).
- **Commentary:** Arabic Speech Corpus male voice (Nawar Halabi, CC-BY-4.0), selected after listening; it is distinct from the matn voice.
- **Structure:** commentary is split into three independent segments — ādāb, fawāʾid, meaning — with shared title clips before each and a `الحديث رقم …` clip before the matn. The app exposes three toggles, default all on.
- **Pacing:** commentary speed is `0.84` (effective ~1.09 after SILMA's 1.3× diacritized-text multiplier); matn stays `0.77`.
- **Clicks and pauses:** SILMA's internal multi-chunk path inserts 0.5–1.3 s of silence and can click at chunk cuts. `pipeline/tts/synth.py` now chunks at punctuation (180 chars, with long narrator chains split at `بن`), applies 8 ms edge fades to every chunk, and joins with a 20 ms equal-power crossfade. No silence is inserted between normal chunks; Ādāb/Fawāʾid bullets get an explicit 0.8 s pause.

**Production self-hosting — solved.** Local SILMA now runs fully self-hosted (`pipeline/tts/setup_silma_local.sh` + `patch_silma_no_nemo.py`), unblocking batch generation for all ~2,000 hadiths without depending on the shared hosted demo. Three real, understood issues, each fixed for a documented reason (not worked around blindly):
1. **SSL:** Python-on-macOS ships no CA bundle → `export SSL_CERT_FILE=$(python3 -c 'import certifi; print(certifi.where())')`.
2. **`pynini`/OpenFST:** confirmed `nemo_text_processing`'s `Normalizer` is only used by `silma_tts.api.SilmaTTS` for generic number/date verbalization (`load_nemo_text_normalizer` / `normalize_text`, both gated behind `enable_normalizer` / `normalize_numbers` flags) — never reachable for our input, which is always pre-diacritized classical Arabic prose with no digits. Patched the package's top-level import to be lazy (`pipeline/tts/patch_silma_no_nemo.py`) instead of fighting the native `pynini` build; call with `SilmaTTS(enable_normalizer=False)` and `.infer(..., normalize_numbers=False)`.
3. **`torchcodec`** (torchaudio's new default audio-loading backend) needs FFmpeg's shared libraries at runtime, not just build time → `brew install ffmpeg` + `export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"`.

Verified end-to-end: `hadith001_silma_local.wav`, 42.76s — matches the hosted-demo sample (43s) almost exactly, confirming the local path produces the same output. Runs on MPS (Apple Silicon GPU). Measured 2026-10-23: **~2 s/word** (79-word matn = 143 s wall / 43 s audio; 141-word commentary = 313 s wall / 86 s audio); the full ~256k-word corpus is roughly **6 days** at `nfe_step=16`, resumable. Use `nfe_step=8` for ~half the time after a listening check.
- The engine must run locally (build machine) — no paid API.

## Male reference voice (2026-10-23)

The project owner preferred a male narrator. SILMA is zero-shot, so the voice is chosen entirely by the reference clip. After an A/B on hadith 001 (79 words), the owner selected:

- **ClArTTS clip `ch_05_arabic_tts_dataset_177.wav`** — single male speaker, Classical Arabic, 4.64 s, CC-BY-4.0.
- Stored at `pipeline/tts/voices/clartts107.wav` with its exact transcript; attribution in `pipeline/tts/voices/README.md`.
- Same 79-word matn: ClArTTS reference produced **33 s** of audio (narration pace), versus **78 s** with an Alafasy Qurʾān reference (recitation cadence). The owner called ClArTTS a clear win.
- **Final voice assignment:** male ClArTTS for the **matn**; SILMA's bundled female reference for the **commentary** (ādāb/fawāʾid/meaning). `generate_audio.py` defaults to both and exposes `--matn-ref-*` / `--comm-ref-*` overrides.

## Dropped-word check (2026-10-29)

SILMA generates each chunk in one pass sized by its character count, and now and then skips a short word wedged between punctuation: the shipped hadith 21 matn had lost «قُلْت» and «قُلْ». A Whisper sweep of all Nawawi narration confirmed that case and a shortened shahada in hadith 3, and nothing else. `generate_audio.py --stt-check` now transcribes every chunk with Whisper (`pipeline/tts/stt_check.py`) and scores it by its weakest word, measured on letters so that fused or misspelt words still count as heard. A chunk scoring under 0.5 is generated again, up to `--stt-attempts` times (default 4), and the best take kept. A retried chunk is printed with every take's score and Whisper transcript; every chunk's takes are appended to `content/audio/stt-check.jsonl` (untracked), and chunks that never come out whole are also listed under `sttWeak` in `content/audio/generation-state.json`.

The full Nawawi narration (all 210 hadith clips; the section titles were kept) was regenerated this way on 2026-10-29 from the reviewed diacritized text. Whisper sent 34 chunks back for another take; five never scored whole, four of them because they contain number words that Whisper writes as digits.
