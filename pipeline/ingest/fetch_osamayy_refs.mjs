#!/usr/bin/env node
// Fetch commentary grounding references for 40 Hadith Nawawi from
// osamayy/40-hadith-nawawi-db (public domain / Unlicense).
// These are DRAFTING REFERENCES, not shipped app content: the classical
// sharh text per hadith, mirrored verbatim under content/references/.
// Verbatim mirror — re-running overwrites (unlike hadith files, refs carry
// no review state).
// Usage (from repo root): node pipeline/ingest/fetch_osamayy_refs.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC =
  'https://raw.githubusercontent.com/osamayy/40-hadith-nawawi-db/main/40-hadith-nawawi.json';
const OUT = path.join(process.cwd(), 'content', 'references', 'nawawi40');

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const src = await res.json();

await mkdir(OUT, { recursive: true });

let n = 0;
for (const [i, entry] of src.entries()) {
  const num = String(i + 1).padStart(3, '0');
  const body = [
    `# مرجع الشرح — الحديث ${i + 1}`,
    '',
    '> مصدر: osamayy/40-hadith-nawawi-db (ملكية عامة / Unlicense).',
    '> نص استرشادي لصياغة التعليق فقط — لا يُشحن مع التطبيق.',
    '',
    '## نص الحديث في هذا المصدر (بلا تشكيل — للمقارنة والتدقيق)',
    '',
    entry.hadith.trim(),
    '',
    '## الشرح والفوائد',
    '',
    entry.description.trim(),
    '',
  ].join('\n');
  await writeFile(path.join(OUT, `${num}.md`), body);
  n++;
}
console.log(`${n} reference files written to content/references/nawawi40/`);
