# Majlis — مجلس

An open-source interactive hadith audiobook (web / iOS / Android). Majlis reads hadith books aloud; after each hadith it reads its manners (آداب), benefits (فوائد), and conclusive meaning (المعنى الإجمالي). Listeners can pause anytime and discuss the hadith with a grounded assistant that answers with cited, logical arguments — never fatwas.

Named after **مجالس السماع** — the traditional gatherings where hadith books were read aloud and discussed.

## Status

Phase 0 — content pipeline complete: both books (42 Nawawi + 1,896 Riyad al-Salihin) have fully diacritized matn and complete commentary, ready for TTS. Phase 1 app scaffold is in place; batch audio generation is next.

**Live web build:** https://tarekeldeeb.github.io/majlis/ — every push to `main` rebuilds the Expo web export and publishes it to the `gh-pages` branch (`.github/workflows/deploy-pages.yml`). Build locally with `cd app && npm run build:pages`.

## Layout

| Path | Purpose |
|---|---|
| `content/` | Reviewed content assets (books, commentary, review state) |
| `pipeline/` | Build-time scripts: ingest → draft → review → TTS → package |
| `docs/` | Content schema, review workflow, TTS evaluation |
| `app/` | React Native (Expo) app — Phase 1 |
| `server/` | Chat backend (LLM providers + MCP clients) — Phase 2 |

## Principles

- **Strictly open source / free components.** No paid or proprietary dependency anywhere.
- **Human-reviewed content only.** Every commentary segment is signed off by two reviewers (Dr Yasmeen Farouk, Tarek Eldeeb) before it ships. See `docs/review-workflow.md`.
- **Matn is immutable.** Hadith text is stored verbatim from its source and never machine-altered.
- **Arabic-first.** v1 is Arabic-only: content, audio, and UI (RTL).

See `CLAUDE.md` for full architecture and roadmap.

## License

Majlis is released under the **Waqf General Public License 2.0** (رخصة وقف العامّة) — the project is a perpetual endowment (وقف) for the benefit of all. The authoritative license text is the Arabic `LICENSE`; `LICENSE-en` is the informal English translation. See the [official Waqf license repository](https://github.com/ojuba-org/waqf).
