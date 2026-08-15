#!/usr/bin/env node
// Generic book ingest from AhmedBaset/hadith-json into the Majlis content schema.
// Non-destructive: existing hadith files are never overwritten — matn is immutable
// once ingested, and commentary/review progress must survive re-runs.
// Usage (from repo root): node pipeline/ingest/ingest_book.mjs <bookId>

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book';
const BOOKS = {
  nawawi40: `${RAW}/forties/nawawi40.json`,
  riyad_assalihin: `${RAW}/other_books/riyad_assalihin.json`,
};

const bookId = process.argv[2];
if (!bookId || !BOOKS[bookId]) {
  console.error(`Usage: ingest_book.mjs <bookId>\nKnown books: ${Object.keys(BOOKS).join(', ')}`);
  process.exit(1);
}

const SRC = BOOKS[bookId];
const OUT = path.join(process.cwd(), 'content', 'books', bookId);

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const src = await res.json();

await mkdir(path.join(OUT, 'hadith'), { recursive: true });

const chapters = (src.chapters ?? []).map((c) => ({ id: c.id, title: c.arabic }));
const chapterById = new Map(chapters.map((c) => [c.id, c]));

const book = {
  id: bookId,
  title: src.metadata.arabic.title,
  author: src.metadata.arabic.author,
  count: src.metadata.length,
  chapters,
  source: { repo: 'AhmedBaset/hadith-json', url: SRC, bookId: src.id },
};
await writeFile(path.join(OUT, 'book.json'), JSON.stringify(book, null, 2) + '\n');

const pad = Math.max(3, String(src.metadata.length).length);
let written = 0;
let kept = 0;
for (const h of src.hadiths) {
  const num = String(h.idInBook).padStart(pad, '0');
  const file = path.join(OUT, 'hadith', `${num}.json`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    kept++;
    continue;
  }
  const chapter = chapterById.get(h.chapterId);
  const doc = {
    id: `${bookId}:${h.idInBook}`,
    book: bookId,
    number: h.idInBook,
    ...(chapter ? { chapter } : {}),
    matn: { arabic: h.arabic, sourceId: h.id },
    commentary: { adab: [], fawaid: [], meaning: null, relatedAyat: [], sources: [] },
    audio: { matn: null, commentary: null },
    review: { status: 'ingested', reviewers: [], approvedAt: null },
  };
  await writeFile(file, JSON.stringify(doc, null, 2) + '\n');
  written++;
}

console.log(
  `${bookId}: book.json written (${chapters.length} chapters); ${written} hadith files created, ${kept} existing files kept.`
);
