#!/usr/bin/env python3
"""Validate Riyad commentary batch JSON files before applying them.

Usage (from repo root):
  python3 -I pipeline/commentary/validate_batches.py <batch.json> [<batch.json> ...]

Checks shape, field counts, lengths, Arabic content, and source presence.
Exit code 1 if any batch has errors.
"""

import json
import re
import sys
from pathlib import Path

ARABIC = re.compile(r"[ء-ي]")
DIAC = re.compile(r"[ً-ْٰ]")
LATIN = re.compile(r"[A-Za-z]")
HTML = re.compile(r"<[^>]+>")
WORD = re.compile(r"\S+")

MIN_ADAB, MAX_ADAB = 2, 4
MIN_FAWAID, MAX_FAWAID = 2, 4
MIN_MEANING_WORDS, MAX_MEANING_WORDS = 15, 150
MAX_ITEM_WORDS = 60


def check_text(label, value, errors, max_words=MAX_ITEM_WORDS, require_diacritics=True):
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: empty or not a string")
        return
    if LATIN.search(value):
        errors.append(f"{label}: contains Latin characters")
    if HTML.search(value):
        errors.append(f"{label}: contains HTML")
    if not ARABIC.search(value):
        errors.append(f"{label}: no Arabic letters")
    if len(WORD.findall(value)) > max_words:
        errors.append(f"{label}: longer than {max_words} words")
    if require_diacritics:
        letters = len(ARABIC.findall(value))
        density = len(DIAC.findall(value)) / letters if letters else 0
        if density < 0.45:
            errors.append(f"{label}: diacritic density {density:.2f} is too low")


def validate_entry(num, entry, errors):
    if not isinstance(entry, dict):
        errors.append(f"{num}: entry is not an object")
        return
    adab = entry.get("adab")
    fawaid = entry.get("fawaid")
    if not isinstance(adab, list) or not (MIN_ADAB <= len(adab) <= MAX_ADAB):
        errors.append(f"{num}: adab must be a list of {MIN_ADAB}-{MAX_ADAB} items")
    else:
        for i, item in enumerate(adab):
            check_text(f"{num}.adab[{i}]", item, errors)
    if not isinstance(fawaid, list) or not (MIN_FAWAID <= len(fawaid) <= MAX_FAWAID):
        errors.append(f"{num}: fawaid must be a list of {MIN_FAWAID}-{MAX_FAWAID} items")
    else:
        for i, item in enumerate(fawaid):
            check_text(f"{num}.fawaid[{i}]", item, errors)

    meaning = entry.get("meaning")
    if not isinstance(meaning, str) or not meaning.strip():
        errors.append(f"{num}.meaning: empty")
    else:
        check_text(f"{num}.meaning", meaning, errors, MAX_MEANING_WORDS)
        n = len(WORD.findall(meaning))
        if n < MIN_MEANING_WORDS:
            errors.append(f"{num}.meaning: only {n} words (min {MIN_MEANING_WORDS})")

    ayat = entry.get("relatedAyat", [])
    if not isinstance(ayat, list):
        errors.append(f"{num}.relatedAyat: not a list")
    else:
        for i, a in enumerate(ayat):
            if not isinstance(a, dict) or not isinstance(a.get("ref"), str) or not isinstance(a.get("text"), str):
                errors.append(f"{num}.relatedAyat[{i}]: needs string ref and text")
            else:
                if ":" not in a["ref"]:
                    errors.append(f"{num}.relatedAyat[{i}].ref: expected سورة:آية")
                check_text(f"{num}.relatedAyat[{i}].text", a["text"], errors, 100)

    sources = entry.get("sources")
    if not isinstance(sources, list) or not (1 <= len(sources) <= 2):
        errors.append(f"{num}.sources: must be a list of 1-2 strings")
    else:
        for i, s in enumerate(sources):
            check_text(f"{num}.sources[{i}]", s, errors, 30, require_diacritics=False)


def main():
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        sys.exit("Usage: validate_batches.py <batch.json> [...]")
    all_errors = []
    total = 0
    for p in paths:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            all_errors.append(f"{p.name}: invalid JSON ({e})")
            continue
        if not isinstance(data, dict):
            all_errors.append(f"{p.name}: top level must be an object")
            continue
        for key, entry in data.items():
            if not key.isdigit() or not (1 <= int(key) <= 1896):
                all_errors.append(f"{p.name}: bad hadith key {key!r}")
                continue
            total += 1
            local = []
            validate_entry(key, entry, local)
            all_errors.extend(f"{p.name}: {e}" for e in local)
    print(f"validated entries: {total}")
    if all_errors:
        print(f"errors: {len(all_errors)}")
        for e in all_errors[:100]:
            print(" -", e)
        sys.exit(1)
    print("all batches valid")


if __name__ == "__main__":
    main()
