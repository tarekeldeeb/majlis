#!/usr/bin/env python3
"""Build per-hadith Riyad al-Salihin references from the clean 6-volume
Sharh Riyad al-Salihin (Ibn Uthaymeen) text.

Input text: six UTF-8 TXT volumes from the Waqfeya/Shamela mirror, placed in
`.cache/sharh/` with names `01_*.txt` ... `06_*.txt` (e.g. the ieasybooks-org
`shamela-waqfeya-library` copies of "شرح رياض الصالحين - ابن عثيمين - ط مدار
الوطن 1-6"). The text is reference material only and is never shipped.

Existing refs under `content/references/riyad_assalihin/` are left untouched
(they carry Shamela 9260 page citations). This script writes refs only for
hadiths that do not have one yet.

Alignment is by normalized matn matching: known refs are located in the text
as anchors, then each remaining hadith is matched inside the gap between its
neighbouring anchors. Hadiths with no confident match get an approximate
context window, clearly marked in the header.

Usage (from repo root):
  python3 -I pipeline/ingest/build_riyad_refs_from_txt.py [--txt-dir DIR]
"""

import argparse
import json
import re
import sys
from bisect import bisect_left
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TXT_DIR = ROOT / ".cache/sharh"
BOOK_DIR = ROOT / "content/books/riyad_assalihin/hadith"
REF_DIR = ROOT / "content/references/riyad_assalihin"
REPORT = ROOT / "content/references/riyad_assalihin/.alignment-report.json"

DIACRITICS = re.compile(r"[ً-ْٰـۖ-ۭ]")
NON_WORD = re.compile(r"[^ء-ي٠-٩۰-۹0-9A-Za-z ]+")
AR_DIGITS = re.compile(r"^[٠-٩۰-۹0-9]+$")
BOOK_TITLE = "شرح رياض الصالحين"
QUOTE = re.compile(r"[«\"“](.+?)[»\"”]", re.S)
SAY = re.compile(r"قال رسول الله[^:]{0,60}:\s*(.*)", re.S)

STOP = set(
    """من في على عن إلى الا أن إن ما لا ولا ثم قد كان قال قالت قالوا هو هي هم هذا هذه
    ذلك التي الذي الذين رسول الله صلى عليه وسلم رضي عنه عنها به له بها فيه فيها مع أو
    أي كل بعض غير بين بعد قبل حتى إذا كانوا كانت يكون تكون ومن وفي وعلى وهو وهي وما
    ومنه ومنها وقد ولا فما أما لكن يا أيها الناس رجل""".split()
)


def norm(s):
    s = DIACRITICS.sub("", s)
    s = (
        s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه")
        .replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    )
    return " ".join(NON_WORD.sub(" ", s).split())


def content(ws):
    return [w for w in ws if len(w) >= 3 and w not in STOP]


def score(a, b):
    a, b = content(a), content(b)
    if not a or not b:
        return 0.0
    ca, cb = Counter(a), Counter(b)
    ov = sum(min(ca[w], cb[w]) for w in ca)
    return 2 * ov / (len(a) + len(b))


def load_words(txt_dir):
    lines = []
    for p in sorted(txt_dir.glob("0[1-6]_*.txt")):
        for ln in p.read_text(encoding="utf-8", errors="replace").splitlines():
            t = ln.strip()
            if not t or t == "PAGE_SEPARATOR" or t == BOOK_TITLE or AR_DIGITS.match(t):
                continue
            lines.append(t)
    cnt = Counter(l for l in lines if l.startswith("باب ") and len(l) < 40)
    lines = [l for l in lines if not (l.startswith("باب ") and len(l) < 40 and cnt[l] > 2)]
    return norm(" ".join(lines)).split()


def load_docs():
    docs = []
    for p in sorted(BOOK_DIR.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        cid = (d.get("chapter") or {}).get("id", 99)
        docs.append(((0 if cid == 0 else 1, cid, d["number"]), d))
    docs.sort(key=lambda x: x[0])
    return docs


def ref_matn(p):
    s = p.read_text(encoding="utf-8")
    m = re.search(r"## المتن كما في الشرح\s*(.*?)(?:\n## |\Z)", s, re.S)
    return m.group(1).strip() if m else ""


def variants(raw):
    out = []
    full = norm(raw)
    if full:
        out.append(full)
    q = QUOTE.findall(raw)
    if q:
        s = norm(max(q, key=len))
        if s and s not in out:
            out.append(s)
    m = SAY.search(raw)
    if m:
        s = norm(m.group(1))
        if s and s not in out:
            out.append(s)
    ws = full.split()
    if len(ws) > 40:
        for part in (
            " ".join(ws[-35:]),
            " ".join(ws[:35]),
            " ".join(ws[len(ws) // 2 - 15: len(ws) // 2 + 15]),
        ):
            if part not in out:
                out.append(part)
    return out


def build_index(words, n):
    idx = {}
    for i in range(len(words) - n + 1):
        idx.setdefault(tuple(words[i:i + n]), []).append(i)
    return idx


def lis(anchors):
    """Keep the longest position-increasing subsequence (anchors sorted by rank)."""
    tails, tails_idx, prev = [], [], [-1] * len(anchors)
    for i, (_, p, _) in enumerate(anchors):
        k = bisect_left(tails, p)
        if k == len(tails):
            tails.append(p)
            tails_idx.append(i)
        else:
            tails[k] = p
            tails_idx[k] = i
        prev[i] = tails_idx[k - 1] if k else -1
    out, i = [], tails_idx[-1] if tails_idx else -1
    while i >= 0:
        out.append(anchors[i])
        i = prev[i]
    return list(reversed(out))


def locate_anchor(matn_words, words, idx, n=6):
    if len(matn_words) < n:
        return None, 0.0
    cands = set()
    step = max(1, (len(matn_words) - n) // 8)
    for j in range(0, max(1, len(matn_words) - n + 1), step):
        cands.update(idx.get(tuple(matn_words[j:j + n]), [])[:200])
    best = (None, 0.0)
    for p in cands:
        s = score(matn_words, words[p:p + len(matn_words) + 12])
        if s > best[1]:
            best = (p, s)
    return best


def find_in_gap(matn_variants, words, lo, hi, idxs):
    best = (None, 0.0)
    for v in matn_variants:
        vw = v.split()
        wl = len(vw)
        n = 3 if wl < 20 else 5
        if wl < n:
            continue
        idx = idxs[n]
        step = max(1, (wl - n) // 10)
        cands = set()
        for j in range(0, max(1, wl - n + 1), step):
            for p in idx.get(tuple(vw[j:j + n]), []):
                if lo <= p <= hi:
                    cands.add(p)
        for p in list(cands)[:800]:
            s = score(vw, words[p:p + wl + 15])
            if s > best[1]:
                best = (p, s)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--txt-dir", default=str(DEFAULT_TXT_DIR))
    args = ap.parse_args()
    txt_dir = Path(args.txt_dir)
    if not list(txt_dir.glob("0[1-6]_*.txt")):
        sys.exit(f"No volume TXT files in {txt_dir}")

    words = load_words(txt_dir)
    docs = load_docs()
    idxs = {n: build_index(words, n) for n in (3, 5, 6)}
    print(f"text words: {len(words)}, hadiths: {len(docs)}", file=sys.stderr)

    # Phase 1: locate existing refs as anchors.
    anchors = []
    for p in sorted(REF_DIR.glob("*.md")):
        num = int(p.stem)
        rank = next((i + 1 for i, (_, d) in enumerate(docs) if d["number"] == num), None)
        if rank is None:
            continue
        mw = norm(ref_matn(p)).split()
        pos, sc = locate_anchor(mw, words, idxs[6])
        if pos is not None and sc >= 0.55:
            anchors.append((rank, pos, sc))
    anchors.sort()
    anchors = lis(anchors)
    pos = {r: p for r, p, _ in anchors}
    sc = {r: s for r, _, s in anchors}
    print(f"anchors: {len(pos)}", file=sys.stderr)

    # Phase 2: fill gaps with multi-variant matching.
    mvs = [variants(d["matn"]["arabic"]) for _, d in docs]
    for _ in range(4):
        added = 0
        ranks = sorted(pos)
        for i, _ in enumerate(docs):
            r = i + 1
            if r in pos:
                continue
            k = bisect_left(ranks, r)
            lo = pos[ranks[k - 1]] if k > 0 else 0
            hi = pos[ranks[k]] if k < len(ranks) else len(words) - 1
            p, s = find_in_gap(mvs[i], words, lo, hi, idxs)
            wl = len(mvs[i][0].split()) if mvs[i] else 0
            threshold = 0.35 if wl < 30 else 0.45
            if p is not None and s >= threshold:
                pos[r] = p
                sc[r] = s
                added += 1
        print(f"  fill pass added {added}; total {len(pos)}", file=sys.stderr)
        if not added:
            break

    ordered = sorted((r, pos[r], sc[r]) for r in pos)
    clean = lis(ordered)
    pos = {r: p for r, p, _ in clean}
    sc = {r: s for r, _, s in clean}
    print(f"matched: {len(pos)} / {len(docs)}", file=sys.stderr)

    # Phase 3: write refs for hadiths that don't have one.
    by_pos = sorted(pos.items(), key=lambda kv: kv[1])
    next_pos = {}
    for (r1, p1), (_, p2) in zip(by_pos, by_pos[1:]):
        next_pos[r1] = p2

    written = exact = approx = 0
    missing = []
    for r, (_, d) in enumerate(docs, 1):
        num = d["number"]
        fp = REF_DIR / f"{num:04d}.md"
        if fp.exists():
            continue
        written += 1
        mw = norm(d["matn"]["arabic"]).split()
        if r in pos:
            exact += 1
            p = pos[r]
            matn_slice = " ".join(words[p:p + len(mw) + 8])
            end = next_pos.get(r, len(words))
            # extend over very short gaps so the commentary is useful
            if end - (p + len(mw)) < 120:
                later = [q for _, q in by_pos if q > end]
                if later:
                    end = min(later[0], end + 1200)
            sharh = " ".join(words[p + len(mw):min(end, p + len(mw) + 3000)])
            match_note = f"درجة مطابقة المتن: {sc[r]:.2f}"
            body_matn = matn_slice
        else:
            approx += 1
            missing.append(num)
            ranks = sorted(pos)
            k = bisect_left(ranks, r)
            lo = pos[ranks[k - 1]] if k > 0 else 0
            hi = pos[ranks[k]] if k < len(ranks) else len(words) - 1
            # linear interpolation by rank
            r_lo = ranks[k - 1] if k > 0 else 1
            r_hi = ranks[k] if k < len(ranks) else len(docs)
            frac = (r - r_lo) / max(1, r_hi - r_lo)
            p = int(lo + frac * (hi - lo))
            body_matn = norm(d["matn"]["arabic"])
            sharh = " ".join(words[max(0, p - 80):min(len(words), p + 900)])
            match_note = "مطابقة تقريبية: لم يُعثر على المتن حرفيًا؛ النافذة السياقية المحيطة"

        header = [
            f"# مرجع الشرح — رياض الصالحين، الحديث {num}",
            "",
            "> المصدر: شرح رياض الصالحين للشيخ محمد بن صالح العثيمين رحمه الله،",
            "> طبعة مدار الوطن (6 مجلدات) — نص كامل من نسخة المكتبة الوقفية.",
            f"> {match_note}",
            "> نص استرشادي لصياغة التعليق فقط — لا يُشحن مع التطبيق.",
            "",
            "## المتن كما في الشرح",
            "",
            body_matn,
            "",
            "## الشرح",
            "",
            sharh or "(لم يُلحق بهذا الحديث شرح مستقل)",
            "",
        ]
        fp.write_text("\n".join(header), encoding="utf-8")

    report = {
        "textWords": len(words),
        "hadiths": len(docs),
        "matched": len(pos),
        "written": written,
        "exact": exact,
        "approximate": approx,
        "approximateNumbers": missing,
        "scores": {str(k): v for k, v in sorted(Counter(round(s, 1) for s in sc.values()).items())},
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "approximateNumbers"}, ensure_ascii=False))
    print(f"refs written: {written} (exact {exact}, approximate {approx})")


if __name__ == "__main__":
    main()
