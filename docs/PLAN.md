# Majlis — Project Plan & Status

> Living plan for the Majlis project. Read this first in a new session, together with `CLAUDE.md`.
> Last updated: 2026-08-15.

## Vision

Open-source interactive hadith audiobook (web / iOS / Android). The app reads hadith books aloud; after each hadith it reads its آداب (manners), فوائد (benefits), and المعنى الإجمالي (conclusive meaning). The listener can pause anytime and discuss the hadith with a grounded AI that answers with cited, logical arguments — never fatwas. Named after مجالس السماع.

## Locked decisions

| Decision | Value |
|---|---|
| Framework | React Native + Expo (TypeScript, expo-router), RTL-first, Arabic-only v1 |
| License | Waqf General Public License 2.0 (`LICENSE` Arabic authoritative; not OSI-listed → F-Droid main repo needs a workaround in Phase 4) |
| Books v1 | الأربعون النووية (42) + رياض الصالحين (1,896, 20 chapters) — no "coming soon" placeholders in the UI |
| LLM strategy | Two providers behind one OpenAI-compatible interface: project-hosted free tier (may get blocked) + BYO-API-key fallback |
| Review policy | Source-derived content is pre-reviewed & bulk-approved (`pipeline/review/approve_all.mjs`, 2026-08-15). Novel commentary requires sign-off by Dr Yasmeen Farouk + Tarek Eldeeb |
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
- Ibn Uthaymeen sharh download from Shamela in progress (resumable script `scrape_9260.sh` in session scratchpad; ~3,771 pages, ~61%+ done, 0 failures). Parser ready: `pipeline/ingest/parse_uthaymeen_sharh.py <cache-dir>` (segments by hadith markers + [الشرح] blocks, aligns by normalized matn because the sharh uses standard Riyad numbering ≠ our ingest numbering).
- **Tashkeel transfer done (partial)**: `pipeline/diacritize/fetch_9books.mjs` + `transfer_tashkeel.mjs` matched 558/1896 Riyad hadiths (29%, avg 70% coverage) against the diacritized 9-books; stored in `matn.diacritized`/`matn.diacritizationSource` (matn.arabic untouched). Ceiling is real (Nawawi paraphrases; some citations outside the 9 books) — see `docs/tts-evaluation.md` for the full breakdown. Remaining 1,338 need the auto-diacritizer fallback.

## In flight / next

1. **App redesign (user-centered)** — two books as a learning journey with per-book progress bars; navigate → read → listen → discuss from any hadith; elegant, classic-with-modern-touch visual language. Progress stored locally (AsyncStorage/localStorage). Discuss = entry point UI now, wired to chat in Phase 2.
2. **Finish sharh scrape → run parser** → `content/references/riyad_assalihin/` + match-rate report.
3. **Riyad commentary generation** — distill آداب/فوائد/معنى per hadith from the Uthaymeen reference (batch pipeline + spot checks). 1,896 hadiths → needs batching strategy.
4. **Auto-diacritizer fallback — solved.** CATT (abjadai/catt) chosen after benchmarking beat Mishkal decisively (near-perfect vs. wrong grammatical forms). Running via `pipeline/diacritize/auto_diacritize_catt.py`, checkpointed incrementally as it progresses (slow on CPU, ~2.5-3/min).
5. **TTS — decided and self-hosted.** SILMA TTS v1 (Apache-2.0), default bundled reference voice, chosen by the project owner after listening (Piper rejected as robotic; a male-voice clone attempt also rejected). Local self-hosting solved — see `docs/tts-evaluation.md` for the three real fixes (SSL certs, a legitimate nemo_text_processing bypass patch, FFmpeg for torchcodec) and `pipeline/tts/setup_silma_local.sh` to reproduce the environment. Batch audio generation for approved content is now unblocked. (`docs/tts-evaluation.md`) — candidates: Habibi, ClArTTS-trained, Piper ar_JO (fallback). Render hadith 001 matn + commentary per engine; blind rating by both reviewers; then batch audio generation for approved content only.
6. **Phase 2 — discussion chat**: `server/` FastAPI/Node; RAG over hadith+commentary; MCP: Tarteel (`https://mcp.tarteel.ai/mcp`, Quran-only: search_verses/get_verse/get_juz) + hadith-mcp/sunnah.com. Providers: FreeTier + ByoKey behind one interface (BYO-key settings UI in the app). Citations mandatory; no fatwas.
7. **Phase 3 — user features & scale**: chapter-based navigation for رياض الصالحين (data already carries أبواب), bookmarks and personal notes, offline audio downloads per book, listening playlists (باب or كتاب as a session), device TTS fallback for chat replies, settings screen. Riyad commentary + audio complete by end of this phase.
8. **Phase 4 — release**: accessibility pass, PWA + Play Store + App Store; F-Droid via self-hosted repo or inclusion discussion (Waqf license).

## Operational notes

- Dev server: port 8081 is often taken by `quranquiznet` — run `npx expo start --web --port 8082`.
- Antigravity (`agy`) delegation available for bounded implementation tasks; relay via the agy-delegate skill; orchestrator reviews and commits (permissions: user approved `--dangerously-skip-permissions --sandbox` for scaffold-type runs).
- The scraper cache lives in the session scratchpad — if lost, re-run `scrape_9260.sh` (it skips cached pages) or re-create from `pipeline/ingest/parse_uthaymeen_sharh.py`'s docstring.
- Known upstream text defects (fix path = corrected ingest, matn is immutable): hadith-json nawawi40 #1 omits Imam Muslim in the dual attribution; #2/#3 lack takhrīj and end with a stray `\n.`
