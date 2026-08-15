# Content schema (v1, Arabic-only)

One JSON file per hadith at `content/books/<bookId>/hadith/<NNN>.json`, plus a `book.json` per book. Files are the review unit: one hadith = one file = one reviewable diff.

## Hadith file

```jsonc
{
  "id": "nawawi40:1",            // "<bookId>:<number>", stable app-wide reference
  "book": "nawawi40",
  "number": 1,                   // idInBook from the source
  "chapter": { "id": 1, "title": "كتاب الأدب" },  // optional; books with real chapter structure (e.g. رياض الصالحين)
  "matn": {
    "arabic": "…",               // verbatim from source — IMMUTABLE after ingest
    "sourceId": 40944            // hadith id in AhmedBaset/hadith-json
  },
  "commentary": {
    "adab": ["…"],               // آداب — manners drawn from the hadith
    "fawaid": ["…"],             // فوائد — benefits / lessons
    "meaning": "…",              // المعنى الإجمالي — conclusive meaning, read last
    "relatedAyat": [             // Quranic cross-references (resolved via Tarteel MCP)
      { "ref": "98:5", "text": "…" }
    ],
    "sources": ["…"]             // the shurūḥ this commentary is grounded in
  },
  "audio": {
    "matn": null,                // CDN path once generated, e.g. "nawawi40/001-matn.mp3"
    "commentary": null
  },
  "review": {
    "status": "ingested",        // ingested | draft | approved
    "reviewers": [],             // names, filled at approval
    "approvedAt": null           // ISO date
  }
}
```

## Review states

- `ingested` — matn only, straight from the source; commentary empty.
- `draft` — commentary drafted (LLM-assisted, grounded in classical shurūḥ), awaiting review.
- `approved` — both reviewers signed off. **Only `approved` hadiths reach release builds.**

Any edit to an `approved` commentary resets status to `draft` and clears `reviewers`.

## Book file (`book.json`)

```jsonc
{
  "id": "nawawi40",
  "title": "الأربعون النووية",
  "author": "الإمام يحيى بن شرف النووي",
  "count": 42,
  "chapters": [{ "id": 1, "title": "…" }],
  "source": { "repo": "AhmedBaset/hadith-json", "url": "…", "bookId": 10 }
}
```

Hadith filenames are zero-padded to at least 3 digits (4 for رياض الصالحين's 1896).

## Sources & licensing (dual-source strategy)

- **Matn** comes from [AhmedBaset/hadith-json](https://github.com/AhmedBaset/hadith-json) (data originally from sunnah.com) because its Arabic is **fully diacritized** — required for TTS. That repo carries no license file; we rely only on the Arabic matn, which is ancient public-domain text. We do not ship its English translations (v1 is Arabic-only; translation licensing must be revisited before any English version).
- **Commentary grounding** comes from [osamayy/40-hadith-nawawi-db](https://github.com/osamayy/40-hadith-nawawi-db) (**public domain / Unlicense**), which carries a classical شرح وفوائد text per hadith, plus other classical shurūḥ named in `commentary.sources`. These references are mirrored under `content/references/` for drafting and review; they are never shipped in the app.
- Osamayy's undiacritized matn also serves as a **correctness cross-check** on hadith-json (e.g. it exposed the missing mention of Imam Muslim in hadith 1's attribution).
- **رياض الصالحين** (`riyad_assalihin`, 1,896 hadiths, 20 chapters) is ingested from the same hadith-json repo. Its matn is **largely undiacritized** — diacritization via tashkeel transfer from the 9-books (see `docs/tts-evaluation.md`).
- **Riyad commentary source candidates** (measured 2026-08-15, both undiacritized ~0.1% so neither helps tashkeel):
  - **دليل الفالحين لابن علان** (d. 1057H — public domain; Shamela #140): safe to use now; dense classical prose.
  - **شرح رياض الصالحين لابن عثيمين** (d. 1421H/2001; Shamela #9260): **adopted as the Riyad commentary grounding source** (project decision 2026-08-15). Basis recorded by the project owner: print rights are reserved to the publisher, while the electronic text is openly distributed (Shamela, the foundation's site, and others). Used as *grounding* for our own commentary segments with per-hadith attribution in `commentary.sources`; the sharh text itself is mirrored under `content/references/` (not shipped in the app).
