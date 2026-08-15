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

**SILMA TTS v1** (Apache-2.0, F5-TTS diffusion architecture, 150M params — the natural-sounding candidate meant to address Piper's robotic quality): local install hit a real wall — its `nemo_text_processing` dependency needs `pynini`, which needs OpenFST headers; installed OpenFST via Homebrew, but the pinned `pynini` version's C++ code calls an OpenFST API (`fst::StringJoin`) renamed in the OpenFST version available (`StrJoin`) — a genuine version incompatibility, not fixable by more include paths. Worked around it entirely by calling the hosted Space's Gradio API directly (`gradio_client`) instead of installing locally — got a real synthesized sample without needing the broken native build. Sample: `.cache/tts-eval/hadith001_silma.wav`.
**Caveat, important:** the returned audio is only 12.5s for a 79-word / 668-char input that should take ~35–45s to read — the hosted Zero-GPU demo almost certainly caps generation length per call. This sample is a **partial read**, not the full hadith; if SILMA's voice quality is preferred after listening, production use would need either self-hosting (once the pynini/OpenFST mismatch is resolved — likely by pinning an older OpenFST via source build, or asking upstream for a `nemo_text_processing` version compatible with modern OpenFST) or chunking text into shorter calls.

**Next action:** both Piper and SILMA samples are ready for the humans in the loop — this project cannot self-assess audio quality. Awaiting Dr Yasmeen Farouk's and Tarek Eldeeb's blind rating per the Method section above before choosing a candidate.
- The engine must run locally (build machine) — no paid API.
