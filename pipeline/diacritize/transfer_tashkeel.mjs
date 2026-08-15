#!/usr/bin/env node
// Tashkeel transfer: diacritize Riyad al-Salihin matn by matching each hadith
// back to its origin in the fully-diacritized 9-books collections and copying
// the diacritics from the aligned source span. See docs/tts-evaluation.md.
//
// Writes into each hadith file's matn.diacritized (+ matn.diacritizationSource
// provenance) WITHOUT touching matn.arabic, which stays the immutable ingested
// text. Safe to re-run: only fills hadiths that don't already have a transfer.
//
// Usage (from repo root): node pipeline/diacritize/transfer_tashkeel.mjs

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.join(process.cwd(), '.cache', '9books');
const RIYAD_DIR = path.join(process.cwd(), 'content', 'books', 'riyad_assalihin', 'hadith');
const MIN_WORD_LEN = 4;
const MIN_COVERAGE = 0.55; // fraction of the Riyad hadith's words the matched run must cover

const DIACRITICS = /[ً-ْٰـ]/g;

function normalizeChar(c) {
  switch (c) {
    case 'أ': case 'إ': case 'آ': return 'ا'; // أ إ آ -> ا
    case 'ة': return 'ه'; // ة -> ه
    case 'ى': return 'ي'; // ى -> ي
    case 'ؤ': return 'و'; // ؤ -> و
    case 'ئ': return 'ي'; // ئ -> ي
    default: return c;
  }
}

/** Tokenize into words, each carrying its [start,end) span in the ORIGINAL raw string. */
function tokenizeWithSpans(raw) {
  const words = [];
  let cur = '';
  let curStart = -1;
  const pushWord = (endExclusive) => {
    if (cur.length > 0) {
      words.push({ norm: cur, start: curStart, end: endExclusive });
      cur = '';
      curStart = -1;
    }
  };
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (DIACRITICS.test(ch)) {
      DIACRITICS.lastIndex = 0;
      continue;
    }
    if (/[ء-ي]/.test(ch)) {
      if (curStart === -1) curStart = i;
      cur += normalizeChar(ch);
    } else {
      pushWord(i);
    }
  }
  pushWord(raw.length);
  return words;
}

const TAKHRIJ_HINTS = [
  [/بخاري/, ['bukhari']],
  [/مسلم/, ['muslim']],
  [/متفق عليه/, ['bukhari', 'muslim']],
  [/أبو داود|ابوداود/, ['abudawud']],
  [/ترمذي/, ['tirmidhi']],
  [/نسائي/, ['nasai']],
  [/ابن ماجه|ابن ماجة/, ['ibnmajah']],
  [/موطأ|مالك/, ['malik']],
  [/دارمي/, ['darimi']],
  [/أحمد/, ['ahmed']],
];

function detectHints(rawMatn) {
  const hits = new Set();
  for (const [re, cols] of TAKHRIJ_HINTS) {
    if (re.test(rawMatn)) cols.forEach((c) => hits.add(c));
  }
  return hits;
}

/** Longest common contiguous run between two normalized-word arrays (by word text). */
function longestCommonRun(a, b) {
  // DP over rolling rows; track best run's end indices in both arrays.
  let prevRow = new Int32Array(b.length + 1);
  let best = { len: 0, aEnd: -1, bEnd: -1 };
  for (let i = 0; i < a.length; i++) {
    const curRow = new Int32Array(b.length + 1);
    for (let j = 0; j < b.length; j++) {
      if (a[i].norm === b[j].norm) {
        const len = prevRow[j] + 1;
        curRow[j + 1] = len;
        if (len > best.len) best = { len, aEnd: i, bEnd: j };
      }
    }
    prevRow = curRow;
  }
  return best;
}

async function loadSources() {
  const files = await readdir(CACHE);
  const sources = []; // { collection, hadiths: [{sourceId, raw, words}] }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const collection = f.replace(/\.json$/, '');
    const doc = JSON.parse(await readFile(path.join(CACHE, f), 'utf-8'));
    const hadiths = doc.hadiths.map((h) => ({
      sourceId: h.id,
      raw: h.arabic,
      words: tokenizeWithSpans(h.arabic),
    }));
    sources.push({ collection, hadiths });
    console.log(`loaded ${collection}: ${hadiths.length} hadiths`);
  }
  return sources;
}

function buildIndex(sources) {
  // word -> list of {collection, idx} for hadiths containing it (only rare-ish words)
  const index = new Map();
  for (const src of sources) {
    src.hadiths.forEach((h, idx) => {
      const seen = new Set();
      for (const w of h.words) {
        if (w.norm.length < MIN_WORD_LEN || seen.has(w.norm)) continue;
        seen.add(w.norm);
        let bucket = index.get(w.norm);
        if (!bucket) index.set(w.norm, (bucket = []));
        bucket.push({ collection: src.collection, idx });
      }
    });
  }
  return index;
}

function candidateHadiths(riyadWords, index, sourcesByCollection, hintCollections) {
  const scores = new Map(); // key `${collection}:${idx}` -> count
  const seenQuery = new Set();
  for (const w of riyadWords) {
    if (w.norm.length < MIN_WORD_LEN || seenQuery.has(w.norm)) continue;
    seenQuery.add(w.norm);
    const bucket = index.get(w.norm);
    if (!bucket || bucket.length > 80) continue; // skip overly common tokens
    for (const { collection, idx } of bucket) {
      if (hintCollections.size > 0 && !hintCollections.has(collection)) continue;
      const key = `${collection}:${idx}`;
      scores.set(key, (scores.get(key) || 0) + 1);
    }
  }
  let entries = [...scores.entries()];
  if (entries.length === 0 && hintCollections.size > 0) {
    // hints too aggressive / wrong — retry unrestricted
    return candidateHadiths(riyadWords, index, sourcesByCollection, new Set());
  }
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, 8).map(([key]) => {
    const [collection, idxStr] = key.split(':');
    const idx = Number(idxStr);
    return { collection, hadith: sourcesByCollection.get(collection).hadiths[idx] };
  });
}

async function main() {
  const sources = await loadSources();
  const sourcesByCollection = new Map(sources.map((s) => [s.collection, s]));
  console.log('building index...');
  const index = buildIndex(sources);
  console.log(`index built: ${index.size} distinct rare words`);

  const files = (await readdir(RIYAD_DIR)).filter((f) => f.endsWith('.json')).sort();
  let matched = 0, skippedExisting = 0, unmatched = 0;
  const coverageLog = [];

  for (const f of files) {
    const filePath = path.join(RIYAD_DIR, f);
    const doc = JSON.parse(await readFile(filePath, 'utf-8'));
    if (doc.matn.diacritized) {
      skippedExisting++;
      continue;
    }
    const raw = doc.matn.arabic;
    const words = tokenizeWithSpans(raw);
    if (words.length < 4) {
      unmatched++;
      continue;
    }
    const hints = detectHints(raw);
    const candidates = candidateHadiths(words, index, sourcesByCollection, hints);

    let best = null; // { collection, sourceId, run, coverage }
    for (const { collection, hadith } of candidates) {
      const run = longestCommonRun(words, hadith.words); // a=riyad words, b=source words
      const coverage = run.len / words.length;
      if (!best || coverage > best.coverage) {
        best = { collection, sourceId: hadith.sourceId, run, coverage, hadith };
      }
    }

    if (best && best.coverage >= MIN_COVERAGE && best.run.len >= 6) {
      const aStartIdx = best.run.aEnd - best.run.len + 1;
      const bStartIdx = best.run.bEnd - best.run.len + 1;
      const srcStart = best.hadith.words[bStartIdx].start;
      const srcEnd = best.hadith.words[best.run.bEnd].end;
      const diacritizedSpan = best.hadith.raw.slice(srcStart, srcEnd);

      doc.matn.diacritized = diacritizedSpan;
      doc.matn.diacritizationSource = {
        collection: best.collection,
        sourceId: best.sourceId,
        coverage: Number(best.coverage.toFixed(3)),
        matchedWords: best.run.len,
        totalWords: words.length,
        riyadWordStart: aStartIdx,
        riyadWordEnd: best.run.aEnd,
        partial: best.coverage < 0.97,
      };
      await writeFile(filePath, JSON.stringify(doc, null, 2) + '\n');
      matched++;
      coverageLog.push(best.coverage);
    } else {
      unmatched++;
    }
  }

  const avgCov = coverageLog.length
    ? (coverageLog.reduce((a, b) => a + b, 0) / coverageLog.length).toFixed(3)
    : 'n/a';
  console.log('\n--- tashkeel transfer report ---');
  console.log(`matched: ${matched}`);
  console.log(`unmatched (needs auto-diacritizer fallback): ${unmatched}`);
  console.log(`already had a transfer (skipped): ${skippedExisting}`);
  console.log(`average coverage among matched: ${avgCov}`);
}

main();
