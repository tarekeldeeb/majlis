# Majlis (مجلس)

Open-source interactive hadith audiobook for **web, iOS, and Android**. The app reads hadith books aloud; after each hadith it reads its manners (ādāb), benefits (fawāʾid), and conclusive meanings. Users can discuss any hadith with a grounded AI that answers with cited, logical arguments.

Named after *majālis al-samāʿ* — the traditional gatherings where hadith books were read aloud and discussed.

## Locked decisions

- **Framework:** React Native (Expo) — one codebase for web, iOS, Android. Arabic-first, RTL-first UI.
- **Language scope v1:** Arabic only (content, audio, and UI).
- **First book:** 40 Hadith Nawawi (42 hadiths — pilot for the whole pipeline). Then Riyad al-Salihin.
- **LLM strategy:** two implementations behind one provider interface —
  1. `FreeTierProvider`: project-hosted free tier (expected to be rate-limited or blocked at times),
  2. `ByoKeyProvider`: user supplies their own API key in settings as the fallback/replacement.
  Both speak one OpenAI-compatible chat interface so the app logic never knows which is active.
- **Content review:** every generated commentary segment requires human sign-off by **Dr Yasmeen Farouk** and **Tarek Eldeeb** before it ships. Unreviewed content never reaches release builds.
- **Licensing constraint:** strictly open-source or free components. No paid/proprietary dependencies anywhere in the stack.

## Architecture

Three layers; the heavy lifting happens at build time, not runtime:

1. **Content pipeline (build-time):** hadith text from `AhmedBaset/hadith-json` + sunnah.com API; commentary (ādāb/fawāʾid/meanings) drafted by LLM grounded in classical shurūḥ (public-domain Arabic originals, e.g. Ibn Rajab's Jāmiʿ al-ʿUlūm wal-Ḥikam), then human-reviewed; output = versioned JSON assets: book → chapter → hadith → {matn, ādāb, fawāʾid, meaning, related āyāt, audio refs}.
2. **Audio (build-time):** pre-generated with an open Arabic TTS (evaluate Habibi / ClArTTS-trained models on fully diacritized text), every file QA'd, hosted on a free CDN. Device TTS only as fallback for dynamic chat replies.
3. **Chat backend (runtime):** RAG over the hadith + its commentary. MCP integrations: **Tarteel MCP** (`https://mcp.tarteel.ai/mcp`) for Quranic cross-references — note it is Quran-only (`search_verses`, `get_verse`, `get_juz`), it has no hadith tools — plus hadith-mcp / sunnah.com for related narrations.

## Planned layout

```
app/       React Native (Expo) app
content/   source texts, generated commentary, review sign-off status
pipeline/  ingestion, commentary drafting, TTS generation, asset packaging
server/    chat backend: LLM provider interface + MCP clients
docs/      planning docs, content schema, review workflow
```

## Guardrails

- The app never issues fatwas. Chat scope is educational discussion of the hadith at hand, always with cited sources; it must say so when asked beyond that scope.
- Religious text is never machine-altered after review: matn text is immutable once ingested; commentary edits restart the review cycle.
- Every AI answer in the app cites its sources (hadith reference, sharḥ, or āyah).

## Roadmap

- **Phase 0** — content pipeline + TTS evaluation, 40 Nawawi content generated and reviewed
- **Phase 1** — MVP audiobook: segmented player (hadith → ādāb → fawāʾid → meaning) with synced text highlighting
- **Phase 2** — discussion chat: provider interface, RAG grounding, citations
- **Phase 3** — Riyad al-Salihin (~1,900 hadiths), bookmarks, progress, offline downloads
- **Phase 4** — release: accessibility, PWA + Play Store + App Store + F-Droid
