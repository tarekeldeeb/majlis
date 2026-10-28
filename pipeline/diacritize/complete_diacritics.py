#!/usr/bin/env python3
"""Fill the diacritics a book's text is missing, keeping every mark it already has.

The 40 Nawawi matn came diacritized from hadith-json, but with gaps: a bare
"صلى الله عليه وسلم" here, a hamza without its vowel there. CATT predicts a full
tashkeel for the stripped text; this script copies CATT's marks only onto letters
the source left bare (or onto a shadda that lacks its vowel), so vetted marks are
never replaced. CATT's habit of putting a fatha on a waṣla alef ("بِاَللَّهِ") and
a sukun on long-vowel letters is not carried over.

- matn: written to `matn.diacritized` with `matn.diacritizationSource`;
  `matn.arabic` stays verbatim (immutable after ingest). A few source defects
  (CORRECTIONS) are fixed in the derived text only.
- commentary: completed in place (project text), provenance in
  `commentary.diacritizationSource`.

Every changed word is listed in content/books/<book>/diacritization-fill.json for review.

Run with the eval venv (from repo root):
  .cache/eval-venv/bin/python -I pipeline/diacritize/complete_diacritics.py --book nawawi40 [--dry-run]
"""

import argparse
import difflib
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

os.environ.setdefault("SSL_CERT_FILE", __import__("certifi").where())

sys.path.insert(0, str(Path(__file__).resolve().parent))
from auto_diacritize_catt_long import chunk_text  # noqa: E402
from catt_tashkeel import CATTEncoderDecoder  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
LETTER = re.compile(r"[ء-ي]")
MARK = re.compile(r"[ً-ْٰ]")
STRIP = re.compile(r"[ً-ْٰـ]")
SHADDA, SUKUN, ALEF = "ّ", "ْ", "ا"
DAMMA, KASRA = "ُ", "ِ"
CHUNK_CHARS = 300  # CATT decodes letter by letter, so cost grows with the square of the length

# Source defects fixed in the derived matn only; matn.arabic keeps them verbatim.
CORRECTIONS = {
    "nawawi40:30": [
        # A sukun on a space and a reversed opening quote around the book's name.
        ("الدَّارَقُطْنِيّ ْ»في سننه» ، وَغَيْرُهُ", "الدَّارَقُطْنِيّ في «سننه»، وَغَيْرُهُ"),
    ],
}


def letter_groups(token):
    """[[letter, marks], ...] for the Arabic letters of a token, in order."""
    groups = []
    for ch in token:
        if LETTER.match(ch):
            groups.append([ch, ""])
        elif MARK.match(ch) and groups:
            groups[-1][1] += ch
    return groups


def base(token):
    return "".join(ch for ch in token if LETTER.match(ch))


def fill_token(source, predicted):
    """Copy predicted marks onto the letters `source` left bare. Returns (token, marks added)."""
    wanted = [marks for _, marks in letter_groups(predicted)]
    out, added, k, i = [], 0, 0, 0
    previous_vowel = ""
    while i < len(source):
        ch = source[i]
        if not LETTER.match(ch):
            out.append(ch)
            i += 1
            continue
        j = i + 1
        while j < len(source) and MARK.match(source[j]):
            j += 1
        own, new = source[i + 1:j], wanted[k] if k < len(wanted) else ""
        if not own:
            if ch == ALEF:
                new = ""  # a bare alef is a long vowel or a waṣla; it takes no mark
            elif new == SUKUN and ((ch == "و" and previous_vowel == DAMMA)
                                   or (ch == "ي" and previous_vowel == KASRA)):
                new = ""  # long vowel, not a consonant
            own, added = new, added + len(new)
        elif set(own) == {SHADDA}:
            vowel = "".join(m for m in new if m != SHADDA)
            own, added = own + vowel, added + len(vowel)
        out.append(ch + own)
        previous_vowel = next((m for m in own if m != SHADDA), "")
        k += 1
        i = j
    return "".join(out), added


def needs_fill(text):
    """True if some letter is bare where full tashkeel would mark it."""
    for token in text.split():
        groups = letter_groups(token)
        for n, (ch, marks) in enumerate(groups):
            if marks or ch in (ALEF, "ى"):
                continue
            before = groups[n - 1] if n else ("", "")
            after = groups[n + 1] if n + 1 < len(groups) else ("", "")
            if (ch == "و" and DAMMA in before[1]) or (ch == "ي" and KASRA in before[1]):
                continue  # long vowel
            if ch == "ل" and before[0] == ALEF and SHADDA in after[1]:
                continue  # the article's lam before a sun letter
            return True
    return False


def complete(text, predicted):
    """Fill `text` from CATT's `predicted`, aligned word by word on letters alone."""
    pieces = re.split(r"(\s+)", text)
    slots = [n for n, piece in enumerate(pieces) if base(piece)]
    pred = [token for token in predicted.split() if base(token)]
    matcher = difflib.SequenceMatcher(None, [base(pieces[n]) for n in slots], [base(t) for t in pred],
                                      autojunk=False)
    changes, unmatched = [], 0
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op != "equal":
            unmatched += i2 - i1
            continue
        for n, p in zip(slots[i1:i2], pred[j1:j2]):
            filled, added = fill_token(pieces[n], p)
            if added:
                changes.append((pieces[n], filled))
                pieces[n] = filled
    result = "".join(pieces)
    if STRIP.sub("", result) != STRIP.sub("", text):
        raise AssertionError(f"letters changed while filling: {text[:60]}")
    return result, changes, unmatched


def diacritize(model, texts):
    """CATT predictions for many texts at once, splitting long ones under its limit."""
    jobs, spans = [], []
    for text in texts:
        chunks = chunk_text(STRIP.sub("", text), max_chars=CHUNK_CHARS)
        spans.append((len(jobs), len(chunks)))
        jobs.extend(chunks)
    # A batch pads to its longest input, so batching by length saves most of the work.
    order = sorted(range(len(jobs)), key=lambda n: len(jobs[n]))
    outputs = [""] * len(jobs)
    for n, out in zip(order, model.do_tashkeel_batch([jobs[n] for n in order], batch_size=16, verbose=False)):
        outputs[n] = out
    return [" ".join(outputs[start:start + count]) for start, count in spans]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="nawawi40")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--predictions", type=Path,
                    help="JSON cache of CATT predictions by input text; reused if present, written otherwise")
    args = ap.parse_args()

    files = sorted((ROOT / "content/books" / args.book / "hadith").glob("*.json"))
    docs = [(fp, json.loads(fp.read_text(encoding="utf-8"))) for fp in files]
    refs, texts = [], []
    for d, (_, doc) in enumerate(docs):
        matn = doc["matn"]["arabic"]
        for old, new in CORRECTIONS.get(doc["id"], []):
            if old not in matn:
                sys.exit(f"{doc['id']}: correction no longer matches the source")
            matn = matn.replace(old, new)
        refs.append((d, "matn", None))
        texts.append(matn)
        c = doc.get("commentary") or {}
        if c.get("meaning"):
            refs.append((d, "meaning", None))
            texts.append(c["meaning"])
        for field in ("adab", "fawaid"):
            for i, item in enumerate(c.get(field) or []):
                refs.append((d, field, i))
                texts.append(item)

    # The matn always goes to CATT; commentary only where a letter is left bare.
    wanted = [text for (_, field, _), text in zip(refs, texts) if field == "matn" or needs_fill(text)]
    cache = {}
    if args.predictions and args.predictions.exists():
        cache = json.loads(args.predictions.read_text(encoding="utf-8"))
    todo = sorted({text for text in wanted if text not in cache})
    print(f"{len(texts)} texts from {len(docs)} hadiths; {len(wanted)} need CATT, {len(todo)} not cached",
          file=sys.stderr)
    if todo:
        cache.update(zip(todo, diacritize(CATTEncoderDecoder(), todo)))
        if args.predictions:
            args.predictions.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    predicted = [cache.get(text, text) for text in texts]

    today = date.today().isoformat()
    report, totals = [], {"matn": 0, "commentary": 0, "unmatched": 0}
    filled = {}
    for (d, field, i), text, pred in zip(refs, texts, predicted):
        new_text, changes, unmatched = complete(text, pred)
        totals["unmatched"] += unmatched
        totals["matn" if field == "matn" else "commentary"] += sum(
            len(MARK.findall(b)) - len(MARK.findall(a)) for a, b in changes)
        filled[(d, field, i)] = (new_text, changes)
        if changes:
            doc = docs[d][1]
            report.append({"hadith": doc["number"], "field": field if i is None else f"{field}[{i}]",
                           "words": [f"{a} → {b}" for a, b in changes]})

    for d, (fp, doc) in enumerate(docs):
        matn_text, matn_changes = filled[(d, "matn", None)]
        corrections = [new for _, new in CORRECTIONS.get(doc["id"], [])]
        if matn_changes or corrections:
            doc["matn"]["diacritized"] = matn_text
            doc["matn"]["diacritizationSource"] = {
                "method": "catt-fill",
                "model": "abjadai/catt (encoder-decoder)",
                "filledWords": len(matn_changes),
                **({"corrections": corrections} if corrections else {}),
                "checkedAt": today,
            }
        c = doc.get("commentary") or {}
        commentary_words = 0
        if (d, "meaning", None) in filled:
            c["meaning"], changes = filled[(d, "meaning", None)]
            commentary_words += len(changes)
        for field in ("adab", "fawaid"):
            for i in range(len(c.get(field) or [])):
                c[field][i], changes = filled[(d, field, i)]
                commentary_words += len(changes)
        if commentary_words:
            c["diacritizationSource"] = {
                "method": "catt-fill",
                "model": "abjadai/catt (encoder-decoder)",
                "filledWords": commentary_words,
                "checkedAt": today,
            }
        if not args.dry_run:
            fp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report_path = ROOT / "content/books" / args.book / "diacritization-fill.json"
    if not args.dry_run:
        report_path.write_text(json.dumps({"checkedAt": today, "method": "catt-fill", "texts": report},
                                          ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    words = sum(len(r["words"]) for r in report)
    print(f"{words} words completed in {len(report)} texts; marks added: matn {totals['matn']}, "
          f"commentary {totals['commentary']}; words CATT could not align (left as is): {totals['unmatched']}"
          + (" [dry run]" if args.dry_run else f"; report: {report_path.relative_to(ROOT)}"))
    for r in report[:12]:
        print(f"  {r['hadith']:3} {r['field']:10} " + " | ".join(r["words"][:4]))


if __name__ == "__main__":
    main()
