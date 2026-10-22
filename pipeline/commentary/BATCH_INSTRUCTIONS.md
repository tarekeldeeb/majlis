# Batch drafting instructions

You are drafting Arabic commentary for the Riyad al-Salihin corpus in this
repository. Work only from the local files named in your assignment.

## Read first

1. `docs/commentary-style.md` — mandatory schema, guardrails, and examples.
2. For each assigned hadith number `N` (four-digit, e.g. `0036`):
   - `content/books/riyad_assalihin/hadith/NNNN.json`
   - `.cache/draft-refs/NNNN.md` — a capped excerpt; **do not open the full
     file under `content/references/`**, it is much larger.

## Produce

One JSON object keyed by the hadith number as a string:

```json
{
  "36": {
    "adab": ["…", "…"],
    "fawaid": ["…", "…", "…"],
    "meaning": "…",
    "relatedAyat": [],
    "sources": ["…"]
  }
}
```

Rules:

- Follow `docs/commentary-style.md` exactly.
- 2–4 `adab`, 2–4 `fawaid`, a 2–4 sentence `meaning`, 1–2 `sources`.
- Ground substantive claims in the reference. If the reference header says
  `مطابقة تقريبية`, keep the commentary general and cite the book/chapter, not
  the sharḥ's specific discussion.
- Fully diacritize every `adab`, `fawaid`, and `meaning` sentence. A QA pass
  rejects low-density strings.
- Never copy the sharḥ verbatim; paraphrase.
- No fatwas, no contemporary rulings, no Latin text, no markdown, no HTML.
- Every hadith in the assignment must appear exactly once in the output.

## Write and validate

Write to the output path given in your assignment, then run:

```sh
python3 -I pipeline/commentary/validate_batches.py <output-path>
```

Fix every reported error and re-run until it prints `all batches valid`.

Do not modify anything under `content/`. Do not run the apply script.
Report the output path, the number of entries, and any hadith you found
difficult or under-sourced.
