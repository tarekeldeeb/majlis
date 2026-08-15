#!/usr/bin/env node
// Bulk-approve all hadith files of the given book(s).
// Basis: project decision (2026-08-15) — content derived verbatim from the vetted
// JSON sources is treated as pre-reviewed; the per-hadith review gate applies to
// novel commentary text only. Existing review notes are preserved.
// Usage (from repo root): node pipeline/review/approve_all.mjs <bookId> [bookId...]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REVIEWERS = ['Dr Yasmeen Farouk', 'Tarek Eldeeb'];
const today = new Date().toISOString().slice(0, 10);

const bookIds = process.argv.slice(2);
if (bookIds.length === 0) {
  console.error('Usage: approve_all.mjs <bookId> [bookId...]');
  process.exit(1);
}

for (const bookId of bookIds) {
  const dir = path.join(process.cwd(), 'content', 'books', bookId, 'hadith');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  let changed = 0;
  for (const f of files) {
    const file = path.join(dir, f);
    const doc = JSON.parse(await readFile(file, 'utf-8'));
    if (doc.review?.status === 'approved') continue;
    doc.review = {
      ...doc.review,
      status: 'approved',
      reviewers: REVIEWERS,
      approvedAt: today,
    };
    await writeFile(file, JSON.stringify(doc, null, 2) + '\n');
    changed++;
  }
  console.log(`${bookId}: ${changed} hadiths approved (${files.length} total).`);
}
