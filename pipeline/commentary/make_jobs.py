#!/usr/bin/env python3
"""Generate self-contained drafting job files for an agent batch.

Each job file contains the style rules, the matn, and a capped ref excerpt for
every assigned hadith, so the drafting agent needs one read and one write
instead of dozens of file reads.

Usage (from repo root): python3 -I pipeline/commentary/make_jobs.py
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"
REF_DIR = ROOT / ".cache/draft-refs"
MANIFEST = ROOT / "pipeline/commentary/batches/manifest.json"
OUT_DIR = ROOT / ".cache/jobs"
OUT_DIR_LITE = ROOT / ".cache/jobs-lite"

MAX_REF = 2800
MAX_REF_LITE = 1400

HEADER = """# Riyad commentary drafting job

Produce one JSON object keyed by hadith number (string). Each value must have:
`adab` (2–4 short diacritized sentences), `fawaid` (2–4), `meaning` (2–4
diacritized sentences), `relatedAyat` (usually []), `sources` (1–2 strings).

Rules:
- Fully diacritize every adab/fawaid/meaning sentence; a validator rejects
  low-density strings.
- Ground substantive claims in the excerpt. If the ref note says
  `مطابقة تقريبية`, keep the draft general and cite the book/chapter only.
- Never copy the excerpt verbatim; paraphrase.
- No fatwas, no contemporary rulings, no Latin text, no markdown inside values.
- Every assigned hadith appears exactly once.

Example entry (hadith 14):

```json
{"14": {"adab": ["بَذْلُ الْكَلِمَةِ الطَّيِّبَةِ لِلنَّاسِ عِنْدَ كُلِّ لِقَاءٍ.", "اعْتِبَارُ حُسْنِ الْكَلَامِ صَدَقَةً يُرْجَى ثَوَابُهَا."], "fawaid": ["الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ يُثَابُ عَلَيْهَا الْمُسْلِمُ.", "أَبْوَابُ الصَّدَقَةِ وَاسِعَةٌ تَشْمَلُ الْقَوْلَ كَمَا تَشْمَلُ الْمَالَ."], "meaning": "أَكَّدَ النَّبِيُّ ﷺ أَنَّ الْكَلِمَةَ الطَّيِّبَةَ صَدَقَةٌ، فَحُسْنُ الْكَلَامِ عِبَادَةٌ مَأْجُورَةٌ يَقْدِرُ عَلَيْهَا كُلُّ مُسْلِمٍ.", "relatedAyat": [], "sources": ["شرح رياض الصالحين للشيخ محمد بن صالح العثيمين رحمه الله — كتاب الأدب"]}}
```

Write the JSON to the output path named in your assignment, then run the validator shown there and fix any errors.

---
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lite", action="store_true", help="smaller excerpts, no duplicate raw matn")
    args = ap.parse_args()
    out_dir = OUT_DIR_LITE if args.lite else OUT_DIR
    max_ref = MAX_REF_LITE if args.lite else MAX_REF
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for batch in manifest["batches"]:
        parts = [HEADER]
        for num in batch["numbers"]:
            fp = HADITH_DIR / f"{num:04d}.json"
            doc = json.loads(fp.read_text(encoding="utf-8"))
            matn = doc["matn"].get("diacritized") or doc["matn"]["arabic"]
            raw_matn = doc["matn"]["arabic"]
            chapter = (doc.get("chapter") or {}).get("title", "")
            ref = (REF_DIR / f"{num:04d}.md").read_text(encoding="utf-8")
            note = "مطابقة تقريبية" if "مطابقة تقريبية" in ref[:600] else "مطابقة دقيقة"
            ref_matn = ""
            if "## المتن كما في الشرح" in ref and "## الشرح" in ref:
                ref_matn = ref.split("## المتن كما في الشرح", 1)[1].split("## الشرح", 1)[0].strip()[:800]
            if "## الشرح" in ref:
                ref = ref.split("## الشرح", 1)[1].strip()[:max_ref]
            parts.append(
                f"\n## الحديث {num}\n\n"
                f"الكتاب/الباب: {chapter}\n"
                f"ملاحظة المرجع: {note}\n\n"
                f"المتن المشكول:\n{matn}\n\n"
                + ("" if args.lite else f"المتن الأصلي (للمقارنة):\n{raw_matn}\n\n")
                + (f"متن المرجع:\n{ref_matn}\n\n" if ref_matn else "")
                + f"مقتطف الشرح:\n{ref}\n"
            )
        out = out_dir / f"{batch['id']}.md"
        out.write_text("".join(parts), encoding="utf-8")
        total += len(batch["numbers"])
    print(f"jobs: {len(manifest['batches'])}, hadiths: {total}, avg bytes: {sum(p.stat().st_size for p in out_dir.glob('*.md')) // max(1, len(manifest['batches']))}")


if __name__ == "__main__":
    main()
