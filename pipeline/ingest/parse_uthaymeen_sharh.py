#!/usr/bin/env python3
"""Parse the cached Shamela pages of Sharh Riyad al-Salihin (Ibn Uthaymeen,
Shamela book 9260) into per-hadith reference files for commentary drafting.

The sharh numbers hadiths in the standard Riyad numbering, which differs from
our ingest numbering (hadith-json reordered the book), so alignment is done by
normalized-matn matching, not by number.

Usage (from repo root):
  python3 pipeline/ingest/parse_uthaymeen_sharh.py <page-cache-dir>

The cache dir holds <n>.html pages fetched from shamela.ws/book/9260/<n>.
Output: content/references/riyad_assalihin/<NNNN>.md (+ match report on stdout).
"""

import html
import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

BOOK_DIR = Path("content/books/riyad_assalihin/hadith")
OUT_DIR = Path("content/references/riyad_assalihin")

DIACRITICS = re.compile(r"[ً-ْٰـ]")
NON_LETTER = re.compile(r"[^ء-ي ]")
HADITH_MARKER = re.compile(r"^\s*([٠-٩]{1,4})\s*[-ـ–]\s*$")
SHARH_MARKER = re.compile(r"^\[\s*الش+")  # [الشرح] with optional tashkeel
HEADER = re.compile(r"^\[.+\]$")
NASS_ANCHOR = 'class="nass margin-top-10"'


def normalize(text: str) -> str:
    t = DIACRITICS.sub("", text)
    t = (
        t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        .replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    )
    t = NON_LETTER.sub(" ", t)
    return " ".join(t.split())


def arabic_int(s: str) -> int:
    return int("".join(str(ord(c) - 0x0660) for c in s))


def extract_nass(raw: str) -> str:
    start = raw.find(NASS_ANCHOR)
    if start == -1:
        return ""
    start = raw.rfind("<div", 0, start)
    depth, i = 0, start
    tag = re.compile(r"<div\b|</div>")
    while i < len(raw):
        m = tag.search(raw, i)
        if not m:
            break
        depth += 1 if m.group(0) == "<div" else -1
        i = m.end()
        if depth == 0:
            break
    seg = raw[start:i]
    text = html.unescape(re.sub(r"<[^>]+>", "\n", seg))
    return re.sub(r"\n{2,}", "\n", text).strip()


def load_pages(cache: Path):
    pages = sorted((int(p.stem), p) for p in cache.glob("*.html"))
    for num, p in pages:
        yield num, extract_nass(p.read_text(errors="replace"))


def parse_segments(cache: Path):
    """Yield (sharh_number, matn_text, sharh_text, first_page) tuples."""
    # Stream all lines with their page ids, then walk the marker structure.
    lines = []  # (page, line)
    for page, text in load_pages(cache):
        for ln in text.split("\n"):
            ln = ln.strip()
            if ln:
                lines.append((page, ln))

    segments = []  # dicts: num, matn(list), sharh(list), page
    group = []  # hadith segments awaiting the next [الشرح]
    current = None  # segment collecting matn lines
    in_sharh = False
    sharh_lines = []

    def flush_sharh():
        nonlocal sharh_lines, group
        if group and sharh_lines:
            text = "\n".join(sharh_lines).strip()
            for seg in group:
                seg["sharh"] = text
                seg["group"] = [g["num"] for g in group]
            segments.extend(group)
        elif group:  # group without sharh (rare) — keep matn-only
            for seg in group:
                seg["sharh"] = ""
                seg["group"] = [g["num"] for g in group]
            segments.extend(group)
        group = []
        sharh_lines = []

    for page, ln in lines:
        m = HADITH_MARKER.match(ln)
        if m:
            if in_sharh:
                flush_sharh()
                in_sharh = False
            current = {"num": arabic_int(m.group(1)), "matn": [], "page": page}
            group.append(current)
            continue
        if SHARH_MARKER.match(ln):
            in_sharh = True
            current = None
            continue
        if HEADER.match(ln):
            continue  # kitab/bab headers pass through both modes
        if in_sharh:
            sharh_lines.append(ln)
        elif current is not None:
            current["matn"].append(ln)
    flush_sharh()
    return segments


def build_index(hadiths):
    """Token -> set of hadith numbers, using moderately rare tokens."""
    idx = defaultdict(set)
    for num, norm in hadiths.items():
        for tok in set(norm.split()):
            if len(tok) >= 4:
                idx[tok].add(num)
    return idx


def best_match(norm_matn, idx, hadiths):
    scores = defaultdict(int)
    toks = [t for t in set(norm_matn.split()) if len(t) >= 4]
    for tok in toks:
        bucket = idx.get(tok)
        if bucket and len(bucket) <= 50:  # skip ubiquitous tokens
            for num in bucket:
                scores[num] += 1
    if not scores:
        return None, 0.0
    candidates = sorted(scores, key=scores.get, reverse=True)[:5]
    best, best_ratio = None, 0.0
    for num in candidates:
        r = SequenceMatcher(None, norm_matn, hadiths[num]).ratio()
        if r > best_ratio:
            best, best_ratio = num, r
    return best, best_ratio


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    cache = Path(sys.argv[1])

    hadiths = {}
    for f in BOOK_DIR.glob("*.json"):
        doc = json.loads(f.read_text())
        hadiths[doc["number"]] = normalize(doc["matn"]["arabic"])
    index = build_index(hadiths)

    segments = parse_segments(cache)
    print(f"parsed segments: {len(segments)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    matched, ambiguous, unmatched = 0, 0, []
    used = {}
    for seg in segments:
        matn = "\n".join(seg["matn"]).strip()
        norm = normalize(matn)
        if len(norm) < 15:
            unmatched.append((seg["num"], "matn too short"))
            continue
        num, ratio = best_match(norm, index, hadiths)
        if num is None or ratio < 0.55:
            unmatched.append((seg["num"], f"no match (best ratio {ratio:.2f})"))
            continue
        if num in used:
            ambiguous += 1
            continue
        used[num] = seg["num"]
        matched += 1
        group = ", ".join(str(n) for n in seg["group"])
        body = "\n".join(
            [
                f"# مرجع الشرح — رياض الصالحين، الحديث {num}",
                "",
                "> المصدر: شرح رياض الصالحين للشيخ محمد بن صالح العثيمين رحمه الله،",
                f"> المكتبة الشاملة كتاب 9260، صفحة {seg['page']} — https://shamela.ws/book/9260/{seg['page']}",
                f"> ترقيم الشرح: {seg['num']}" + (f" (شرح مشترك للأحاديث {group})" if len(seg["group"]) > 1 else ""),
                f"> درجة مطابقة المتن: {ratio:.2f}",
                "> نص استرشادي لصياغة التعليق فقط — لا يُشحن مع التطبيق.",
                "",
                "## المتن كما في الشرح",
                "",
                matn,
                "",
                "## الشرح",
                "",
                seg["sharh"] or "(لم يُلحق بهذا الحديث شرح مستقل)",
                "",
            ]
        )
        (OUT_DIR / f"{num:04d}.md").write_text(body)

    print(f"matched: {matched} / {len(hadiths)} hadiths; duplicate-target: {ambiguous}")
    print(f"unmatched sharh segments: {len(unmatched)}")
    for num, why in unmatched[:20]:
        print(f"  sharh #{num}: {why}")


if __name__ == "__main__":
    main()
