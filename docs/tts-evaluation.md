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
- The engine must run locally (build machine) — no paid API.
