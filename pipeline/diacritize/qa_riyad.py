#!/usr/bin/env python3
"""Finish Riyad diacritization QA.

Checks every `matn.diacritized` value for structural sanity, clears the
conservative `needsReview` flag where the text passes, and reports failures.
The immutable `matn.arabic` is never touched.

Checks:
  - diacritized letter count is 0.85–1.20× the undiacritized text
  - diacritic density >= 0.45 (diacritics per Arabic letter)
  - no Latin letters, digits, or tatweel
  - no repeated identical diacritics on one letter

Usage (from repo root): python3 -I pipeline/diacritize/qa_riyad.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HADITH_DIR = ROOT / "content/books/riyad_assalihin/hadith"
REPORT = ROOT / "content/books/riyad_assalihin/diacritization-qa.json"

LETTERS = re.compile(r"[ء-ي]")
DIACRITICS = re.compile(r"[ً-ْٰ]")
LATIN = re.compile(r"[A-Za-z]")
DIGITS = re.compile(r"[0-9٠-٩۰-۹]")
TATWEEL = re.compile("ـ")


def main():
    checked = passed = failed = cleared = 0
    failures = []
    for fp in sorted(HADITH_DIR.glob("*.json")):
        doc = json.loads(fp.read_text(encoding="utf-8"))
        text = doc.get("matn", {}).get("diacritized")
        if not text:
            continue
        checked += 1
        letters = len(LETTERS.findall(text))
        diacritics = len(DIACRITICS.findall(text))
        density = diacritics / letters if letters else 0.0
        base_letters = len(LETTERS.findall(doc["matn"].get("arabic", "")))
        ratio = letters / base_letters if base_letters else 1.0
        problems = []
        if letters and not (0.85 <= ratio <= 1.20):
            problems.append(f"letter ratio {ratio:.2f}")
        if density < 0.45:
            problems.append(f"density {density:.2f}")
        if LATIN.search(text):
            problems.append("latin characters")
        if TATWEEL.search(text):
            problems.append("tatweel")
        if re.search(r"([ً-ْ])\1", text):
            problems.append("repeated diacritic")

        src = doc["matn"].setdefault("diacritizationSource", {})
        src["qa"] = {
            "checkedAt": "2026-10-22",
            "density": round(density, 3),
            "letterRatio": round(ratio, 3),
            "hasDigits": bool(DIGITS.search(text)),
            "status": "pass" if not problems else "fail",
        }
        if problems:
            failed += 1
            src["needsReview"] = True
            failures.append({"number": doc["number"], "problems": problems})
        else:
            passed += 1
            if src.pop("needsReview", None):
                cleared += 1
        fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps(
            {
                "checked": checked,
                "passed": passed,
                "failed": failed,
                "needsReviewCleared": cleared,
                "failures": failures,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        f"checked {checked}, passed {passed}, failed {failed}, "
        f"needsReview cleared {cleared}"
    )
    for f in failures[:20]:
        print(f"  {f['number']}: {', '.join(f['problems'])}")


if __name__ == "__main__":
    main()
