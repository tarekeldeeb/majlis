# Majlis — Project Plan & Status

> Living plan for the Majlis project. Read this first in a new session, together with `CLAUDE.md`.
> Last updated: 2026-10-22.

## Vision

Open-source interactive hadith audiobook (web / iOS / Android). The app reads hadith books aloud; after each hadith it reads its آداب (manners), فوائد (benefits), and المعنى الإجمالي (conclusive meaning). The listener can pause anytime and discuss the hadith with a grounded AI that answers with cited, logical arguments — never fatwas. Named after مجالس السماع.

## Locked decisions

| Decision | Value |
|---|---|
| Framework | React Native + Expo (TypeScript, expo-router), RTL-first, Arabic-only v1 |
| License | Waqf General Public License 2.0 (`LICENSE` Arabic authoritative; not OSI-listed → F-Droid main repo needs a workaround in Phase 4) |
| Books v1 | الأربعون النووية (42) + رياض الصالحين (1,896, 20 chapters) — no "coming soon" placeholders in the UI |
| LLM strategy | Two providers behind one OpenAI-compatible interface: project-hosted free tier (may get blocked) + BYO-API-key fallback |
| Review policy | Source-derived content is pre-reviewed & bulk-approved (`pipeline/review/approve_all.mjs`, 2026-08-15). **Tarek Eldeeb reviewed the Riyad corpus on 2026-10-23**; Riyad files carry `reviewers: ["Tarek Eldeeb"]` and `reviewPolicy: "owner-reviewed-second-pending"`. Dr Yasmeen Farouk's sign-off remains mandatory before public release. |
| Matn source | AhmedBaset/hadith-json (fully diacritized for 40 Nawawi and the 9 books; Riyad matn largely undiacritized) |
| Commentary sources | 40 Nawawi: osamayy/40-hadith-nawawi-db (public domain) + Ibn Rajab. Riyad: **شرح رياض الصالحين لابن عثيمين** (Shamela #9260; owner decision: e-text openly distributed, print rights reserved) — mirrored as references, never shipped verbatim |
| Diacritization for Riyad | **Tashkeel transfer** from the diacritized 9-books in hadith-json (matn matching via takhrīj + normalized alignment); open auto-diacritizer (CAMeL/CATT) as fallback with QA flags |
| Git remote | git@github.com:tarekeldeeb/majlis.git (push when owner says so) |

## Status (done)

- Repo + docs + content schema (`docs/content-schema.md`), review workflow, TTS eval plan.
- Both books ingested (`pipeline/ingest/ingest_book.mjs`), all 1,938 hadiths `approved`.
- **40 Nawawi commentary 100% complete** — all 42 hadiths with آداب/فوائد/معنى/آيات/مصادر, fully diacritized, approved, no internal notes.
- Sharh references mirrored: osamayy (42 files) under `content/references/nawawi40/`.
- Expo app scaffold works (web verified): library → book list → hadith screen with commentary + placeholder audio bar. Content bundled via `app/scripts/sync-content.mjs` (gitignored copies; `content/` is the single source of truth; hooks: `prestart`, `build:web`).
- Gates: `npm run sync-content`, `npx tsc --noEmit`, `npx expo export --platform web` — all green as of last commit.
- **Sharh references complete**: the original 688 Shamela refs are kept; 1,208 more were recovered from the clean six-volume sharh TXT (1,016 exact alignments + 192 approximate). Full coverage: 1,896/1,896 refs. See `content/references/riyad_assalihin/.alignment-report.json`.
- **Tashkeel transfer done (partial)**: `pipeline/diacritize/fetch_9books.mjs` + `transfer_tashkeel.mjs` matched 558/1896 Riyad hadiths (29%, avg 70% coverage) against the diacritized 9-books; stored in `matn.diacritized`/`matn.diacritizationSource` (matn.arabic untouched). Ceiling is real (Nawawi paraphrases; some citations outside the 9 books) — see `docs/tts-evaluation.md` for the full breakdown. Remaining 1,338 need the auto-diacritizer fallback.
- **Riyad reference coverage now 100%** (2026-10-22): all 1,896 hadiths have a file under `content/references/riyad_assalihin/`. The original 688 Shamela refs are kept; 1,208 new refs were built from the clean six-volume *Sharh Riyad al-Salihin* TXT (ط. مدار الوطن) by `pipeline/ingest/build_riyad_refs_from_txt.py` — 1,016 exact matn alignments and 192 approximate context windows (marked in each file and in `.alignment-report.json`). The 192 approximate ones have no verbatim matn in the sharh and must be drafted conservatively.
- **Riyad commentary 1,896/1,896 — complete (2026-10-22).** Every hadith has آداب/فوائد/معنى/مصادر, fully diacritized (11,686 commentary strings, 0 below the density threshold), and was **reviewed by Tarek Eldeeb on 2026-10-23** (`reviewPolicy: "owner-reviewed-second-pending"`); Dr Yasmeen Farouk's sign-off is pending. Batches live in `pipeline/commentary/batches/`; `apply_all.sh` validates and applies them. The 192 approximate refs were drafted conservatively from the matn/chapter; agents flagged additional under-sourced cases where the sharh excerpt covered a neighbouring hadith.

## In flight / next

1. **App redesign (user-centered)** — two books as a learning journey with per-book progress bars; navigate → read → listen → discuss from any hadith; elegant, classic-with-modern-touch visual language. Progress stored locally (AsyncStorage/localStorage). Discuss = entry point UI now, wired to chat in Phase 2.
2. **Sharh reference coverage — done.** `pipeline/ingest/build_riyad_refs_from_txt.py` filled the 1,208 missing refs from the clean six-volume sharh TXT: 1,016 exact alignments + 192 marked approximate; the 688 original Shamela refs are kept. Report: `content/references/riyad_assalihin/.alignment-report.json`.
3. **Riyad commentary generation — done (1,896/1,896).** All refs are in place; 47 batches were drafted from self-contained job files, validated, and applied. **Tarek Eldeeb reviewed the corpus on 2026-10-23**; before public release, Dr Yasmeen Farouk must sign off and reviewers should spot-check the 192 approximate refs and the hadiths agents flagged as under-sourced (concentrated in chapters 8, 15–18).
4. **Auto-diacritizer fallback — done.** CATT (abjadai/catt) chosen after benchmarking beat Mishkal decisively (near-perfect vs. wrong grammatical forms). All 1,896 Riyad hadiths now diacritized: 558 tashkeel-transfer + 1,299 direct CATT + 39 via a chunked variant (`auto_diacritize_catt_long.py`) for hadiths exceeding CATT's ~1024-token encoder limit. Combined with the 42 Nawawi hadiths, the full 1,938-hadith corpus is TTS-ready. **2026-10-22 correction:** the transfer hadiths stored only the matched span; `rediacritize_transfer_full.py` + `merge_transfer_spans.py` now produce full-length text (CATT boundaries + transfer core), and `qa_riyad.py` passes 1,896/1,896 (letter coverage and density).
5. **TTS — decided, self-hosted, pilot validated.** SILMA TTS v1 (Apache-2.0). Matn and hadith-number clips use the ClArTTS male voice; commentary uses the Arabic Speech Corpus male voice (Nawar Halabi, CC-BY-4.0), approved by the owner on 2026-10-23. Commentary is split into three independently toggleable segments — ādāb, fawāʾid, meaning — with shared title clips before each and a number clip before the matn. `pipeline/tts/synth.py` replaces SILMA's 0.5–1.3 s inter-chunk silence with punctuation-aware chunking (180 chars, long narrator chains split at `بن`), 8 ms chunk-edge fades, and a 20 ms equal-power crossfade; Ādāb/Fawāʾid bullets get a 0.8 s pause. Commentary speed is 0.84 (effective ~1.09); matn stays 0.77. Hadith 1 is the pilot; full Nawawi regeneration and Riyad audio remain pending. Local self-hosting setup: `docs/tts-evaluation.md`; reproduce with `pipeline/tts/setup_silma_local.sh`.
6. **Phase 2 — discussion chat**: `server/` FastAPI/Node; RAG over hadith+commentary; MCP: Tarteel (`https://mcp.tarteel.ai/mcp`, Quran-only: search_verses/get_verse/get_juz) + hadith-mcp/sunnah.com. Providers: FreeTier + ByoKey behind one interface (BYO-key settings UI in the app). Citations mandatory; no fatwas.
7. **Phase 3 — user features & scale**: chapter-based navigation for رياض الصالحين (data already carries أبواب), bookmarks and personal notes, offline audio downloads per book, listening playlists (باب or كتاب as a session), device TTS fallback for chat replies, settings screen. Riyad commentary + audio complete by end of this phase.
8. **Phase 4 — release**: accessibility pass, PWA + Play Store + App Store; F-Droid via self-hosted repo or inclusion discussion (Waqf license).

## Operational notes

- Dev server: port 8081 is often taken by `quranquiznet` — run `npx expo start --web --port 8082`.
- Antigravity (`agy`) delegation available for bounded implementation tasks; relay via the agy-delegate skill; orchestrator reviews and commits (permissions: user approved `--dangerously-skip-permissions --sandbox` for scaffold-type runs).
- The scraper cache lives in the session scratchpad — if lost, re-run `scrape_9260.sh` (it skips cached pages) or re-create from `pipeline/ingest/parse_uthaymeen_sharh.py`'s docstring.
- Known upstream text defects (fix path = corrected ingest, matn is immutable): hadith-json nawawi40 #1 omits Imam Muslim in the dual attribution; #2/#3 lack takhrīj and end with a stray `\n.`
