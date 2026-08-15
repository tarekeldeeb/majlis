#!/usr/bin/env node
// Download the fully-diacritized "9 books" collections from hadith-json into a
// local scratch cache. These are the tashkeel source for the Riyad al-Salihin
// transfer (see docs/tts-evaluation.md). Not committed — re-run to refresh.
// Usage (from repo root): node pipeline/diacritize/fetch_9books.mjs

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/the_9_books';
const BOOKS = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'darimi', 'ahmed'];
const OUT = path.join(process.cwd(), '.cache', '9books');

await mkdir(OUT, { recursive: true });

for (const book of BOOKS) {
  const file = path.join(OUT, `${book}.json`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    console.log(`skip (cached): ${book}`);
    continue;
  }
  const url = `${RAW}/${book}.json`;
  process.stdout.write(`fetching ${book}... `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`FAILED (${res.status})`);
    continue;
  }
  const text = await res.text();
  await writeFile(file, text);
  console.log(`ok (${(text.length / 1e6).toFixed(1)} MB)`);
}
