# Content review workflow

Reviewers: **Dr Yasmeen Farouk** and **Tarek Eldeeb**. Both must approve; there is no single-reviewer path.

> **Policy decision (2026-08-15):** content derived verbatim from the vetted JSON sources (hadith-json matn, osamayy-grounded commentary) is treated as **pre-reviewed** and bulk-approved via `pipeline/review/approve_all.mjs`. The per-hadith review flow below applies to **novel commentary text** written for Majlis going forward.

> **Review deferral (2026-10-22):** the project owner has deferred review of novel commentary until further notice so the full corpus can be completed for TTS. Deferred items are marked `review.status: "approved"`, `reviewers: []`, `reviewPolicy: "deferred"` — approved for pipeline/TTS purposes only, **not** for public release. The two-reviewer flow below remains mandatory before release.

## Flow

1. **Ingest** (`pipeline/ingest/`) writes matn-only files with `review.status: "ingested"`. The ingest script never overwrites an existing hadith file, so review progress survives re-runs.
2. **Draft**: commentary (آداب / فوائد / المعنى الإجمالي) is drafted — LLM-assisted, always grounded in named classical shurūḥ listed in `commentary.sources`. Status becomes `draft`.
3. **Review**: drafts are reviewed via pull request — one PR per batch of hadiths, reviewed file-by-file. Reviewers check: fidelity to the cited sharḥ, no fabricated attributions, correct āyah references, appropriate register for read-aloud Arabic.
4. **Approve**: when both reviewers sign, set `review.status: "approved"`, `reviewers: ["Dr Yasmeen Farouk", "Tarek Eldeeb"]`, `approvedAt`. Merge.
5. **TTS** runs only on `approved` content. Release builds package only `approved` hadiths — the packager must enforce this.

## Hard rules

- **Matn is immutable.** If a matn error is suspected, the fix is a new ingest from a corrected source, never a hand edit — and it invalidates the hadith's audio.
- **Editing approved commentary resets it to `draft`** and clears `reviewers`; it must pass review again.
- **No fatwa content.** Commentary states meanings and lessons from the cited shurūḥ; it does not rule on contemporary specific cases.
- Every commentary must list at least one classical source in `commentary.sources`.
