#!/usr/bin/env node
// GitHub Pages serves static files only. The web export is a single-page app,
// so unknown deep links (/book/... refreshes) must fall back to index.html,
// and .nojekyll keeps Jekyll from dropping the _expo/ directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(appRoot, 'dist');
const indexHtml = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('❌ dist/index.html not found — run `npm run build:web` first.');
  process.exit(1);
}

fs.copyFileSync(indexHtml, path.join(distDir, '404.html'));
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

console.log('✅ Added 404.html fallback and .nojekyll to dist/');
