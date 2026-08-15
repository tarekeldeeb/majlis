# Pipeline

Build-time stages; each stage reads/writes `content/` and is safe to re-run:

1. **ingest/** — fetch source books, write matn-only hadith files (never overwrites existing files).
2. **draft/** — LLM-assisted commentary drafting grounded in classical shurūḥ (Phase 0, upcoming).
3. **tts/** — generate audio for `approved` hadiths only (engine chosen via `docs/tts-evaluation.md`).
4. **package/** — bundle `approved` content + audio manifests into app assets; must exclude anything not approved.

Scripts are dependency-free Node ≥ 18 (`.mjs`) unless a stage needs Python (TTS will).

```sh
node pipeline/ingest/fetch_nawawi40.mjs   # from the repo root
```
