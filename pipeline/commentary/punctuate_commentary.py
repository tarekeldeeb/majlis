#!/usr/bin/env python3
"""Conservative Arabic comma insertion for commentary read-aloud text.

Adds commas only before clear clause starters and never inside Quranic verses,
hadith quotations, or parenthetical citations. Dry-run by default; pass
--apply to write the hadith JSON files.

Usage (from repo root):
  python3 -I pipeline/commentary/punctuate_commentary.py --book riyad_assalihin
  python3 -I pipeline/commentary/punctuate_commentary.py --book all --apply
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "content/books"
PARTS = ("adab", "fawaid", "meaning")

PROTECTED = re.compile(r"(﴿.*?﴾|«.*?»|\([^)]*\))", re.S)
TOKEN = re.compile(r"\S+")

SAFE = {
    "ثُمَّ", "لَكِنَّ", "لَكِنْ", "بَلْ", "أَمَّا", "فَأَمَّا", "وَأَمَّا",
    "لِأَنَّ", "لِأَنَّهُ", "لِأَنَّهَا", "حَتَّى", "إِذَا", "لَمَّا",
    "حَيْثُ", "كَمَا", "بِخِلَافِ", "أَيْ", "مِثْلَ", "كَذَلِكَ",
    "وَكَذَلِكَ", "وَلَكِنَّ", "وَلَكِنْ", "وَقَدْ", "فَقَدْ", "فَإِنَّ",
    "وَبِالْجُمْلَةِ", "وَالْحَاصِلُ", "فَالْحَاصِلُ", "وَلِذَلِكَ",
    "فَلِذَلِكَ", "وَبِهَذَا",
}

FA_VERBS = {
    "فَقَالَ", "فَقَالَتْ", "فَقَالُوا", "فَبَيَّنَ", "فَدَلَّ", "فَذَكَرَ",
    "فَأَخْبَرَ", "فَأَخْبَرَهُ", "فَأَخْبَرَهُمْ", "فَسَأَلَ", "فَسَأَلَهُ",
    "فَسَأَلَتْهُ", "فَكَانَ", "فَيَجِبُ", "فَيَنْبَغِي", "فَلَيْسَ",
    "فَأَمَرَ", "فَأَمَرَهُ", "فَجَمَعَ", "فَرَأَى", "فَعَلَ", "فَدَعَا",
    "فَيَكُونُ", "فَجَاءَ", "فَأَجَابَ", "فَيَقُولُ", "فَسَلَّمَ",
    "فَنَهَاهُ", "فَأَنْكَرَ",
}

WA_MARKERS = {
    "وَقَدْ", "وَلَكِنَّ", "وَلَكِنْ", "وَلِذَلِكَ", "وَبِالْجُمْلَةِ",
    "وَالْحَاصِلُ", "وَبِهَذَا", "وَكَذَلِكَ", "وَقَالَ", "وَقَالَتْ",
    "وَكَانَ",
}


def _clean(token: str) -> str:
    return token.strip("،؛:.!؟»«﴾﴿()")


def punctuate(text: str, min_words: int = 8) -> str:
    if not text or "،" in text or "," in text:
        return text
    words = TOKEN.findall(text)
    if len(words) < min_words:
        return text

    protected = []

    def mask(match):
        protected.append(match.group(0))
        return f"⟦P{len(protected) - 1}⟧"

    masked = PROTECTED.sub(mask, text)
    tokens = TOKEN.findall(masked)
    out = []
    inserted = 0
    for index, raw in enumerate(tokens, 1):
        clean = _clean(raw)
        insert = (
            index > 3
            and index < len(tokens) - 3
            and (clean in SAFE or clean in FA_VERBS or clean in WA_MARKERS)
        )
        if insert and out:
            prev = out[-1]
            if prev and prev[-1] not in "،؛:.!؟»«﴾﴿(":
                out[-1] = prev + "،"
                inserted += 1
        out.append(raw)

    if inserted == 0:
        return text
    result = " ".join(out)
    for i, span in enumerate(protected):
        result = result.replace(f"⟦P{i}⟧", span)
    return " ".join(result.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="all", help="book id or 'all'")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--min-words", type=int, default=8)
    args = ap.parse_args()

    books = ["nawawi40", "riyad_assalihin"] if args.book == "all" else [args.book]
    changed = total = 0
    samples = []
    for book in books:
        for fp in sorted((BOOKS / book / "hadith").glob("*.json")):
            doc = json.loads(fp.read_text(encoding="utf-8"))
            commentary = doc.get("commentary") or {}
            dirty = False
            for part in PARTS:
                value = commentary.get(part)
                if isinstance(value, list):
                    new = [punctuate(s, args.min_words) for s in value]
                    if new != value:
                        total += sum(1 for a, b in zip(value, new) if a != b)
                        changed += 1
                        dirty = True
                        if len(samples) < 12:
                            for a, b in zip(value, new):
                                if a != b:
                                    samples.append((doc["number"], part, a, b))
                        commentary[part] = new
                elif isinstance(value, str):
                    new = punctuate(value, args.min_words)
                    if new != value:
                        total += 1
                        changed += 1
                        dirty = True
                        if len(samples) < 12:
                            samples.append((doc["number"], part, value, new))
                        commentary[part] = new
            if dirty and args.apply:
                doc["commentary"] = commentary
                fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{'applied' if args.apply else 'dry-run'}: {changed} hadith file(s), {total} string(s) changed")
    for number, part, before, after in samples:
        print(f"\n--- hadith {number} / {part}\nBEFORE: {before}\nAFTER : {after}")


if __name__ == "__main__":
    main()
