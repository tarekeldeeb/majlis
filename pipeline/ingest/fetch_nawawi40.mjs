#!/usr/bin/env node
// Ingest 40 Hadith Nawawi from AhmedBaset/hadith-json into the Majlis content schema.
// Non-destructive: existing hadith files are never overwritten — matn is immutable
// once ingested, and commentary/review progress must survive re-runs.
// Usage (from repo root): node pipeline/ingest/fetch_nawawi40.mjs

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const SRC =
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/forties/nawawi40.json';
const OUT = path.join(process.cwd(), 'content', 'books', 'nawawi40');

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const src = await res.json();

await mkdir(path.join(OUT, 'hadith'), { recursive: true });

const book = {
  id: 'nawawi40',
  title: src.metadata.arabic.title,
  author: src.metadata.arabic.author,
  count: src.metadata.length,
  source: { repo: 'AhmedBaset/hadith-json', url: SRC, bookId: src.id },
};
await writeFile(path.join(OUT, 'book.json'), JSON.stringify(book, null, 2) + '\n');

let written = 0;
let kept = 0;
for (const h of src.hadiths) {
  const num = String(h.idInBook).padStart(3, '0');
  const file = path.join(OUT, 'hadith', `${num}.json`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    kept++;
    continue;
  }
  const doc = {
    id: `nawawi40:${h.idInBook}`,
    book: 'nawawi40',
    number: h.idInBook,
    matn: { arabic: h.arabic, sourceId: h.id },
    commentary: { adab: [], fawaid: [], meaning: null, relatedAyat: [], sources: [] },
    audio: { matn: null, commentary: null },
    review: { status: 'ingested', reviewers: [], approvedAt: null },
  };
  await writeFile(file, JSON.stringify(doc, null, 2) + '\n');
  written++;
}

console.log(`book.json written; ${written} hadith files created, ${kept} existing files kept.`);
