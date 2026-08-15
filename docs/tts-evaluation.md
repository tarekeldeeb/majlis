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
- The engine must run locally (build machine) — no paid API.
