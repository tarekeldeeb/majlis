#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, '..');
const contentBooksDir = path.resolve(appRoot, '../content/books');
const targetAssetsBooksDir = path.resolve(appRoot, 'assets/content/books');
const manifestFile = path.resolve(appRoot, 'src/data/manifest.ts');
const contentAudioDir = path.resolve(appRoot, '../content/audio');
const targetAssetsAudioDir = path.resolve(appRoot, 'assets/content/audio');
const audioManifestFile = path.resolve(appRoot, 'src/data/audio-manifest.ts');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🔄 Syncing content from', contentBooksDir, 'to', targetAssetsBooksDir);

if (!fs.existsSync(contentBooksDir)) {
  console.error('❌ Content directory not found at:', contentBooksDir);
  process.exit(1);
}

// 1. Copy content directory into assets
fs.rmSync(targetAssetsBooksDir, { recursive: true, force: true });
copyDirRecursive(contentBooksDir, targetAssetsBooksDir);

// 2. Discover all books and hadiths
const bookDirs = fs
  .readdirSync(contentBooksDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const imports = [];
const bookEntries = [];
const hadithEntriesByBook = [];
const booksListEntries = [];

let totalHadiths = 0;

for (const bookId of bookDirs) {
  const bookDir = path.join(contentBooksDir, bookId);
  const bookJsonPath = path.join(bookDir, 'book.json');

  if (!fs.existsSync(bookJsonPath)) {
    console.warn(`⚠️ Skipping ${bookId}: book.json not found.`);
    continue;
  }

  const cleanBookId = bookId.replace(/[^a-zA-Z0-9_]/g, '_');
  const bookVar = `book_${cleanBookId}`;
  imports.push(`import ${bookVar} from '../../assets/content/books/${bookId}/book.json';`);
  bookEntries.push(`  '${bookId}': ${bookVar} as Book,`);
  booksListEntries.push(`  ${bookVar} as Book,`);

  const hadithDir = path.join(bookDir, 'hadith');
  const hadithFiles = fs.existsSync(hadithDir)
    ? fs
        .readdirSync(hadithDir)
        .filter((f) => f.endsWith('.json'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        })
    : [];

  const hadithMapLines = [];

  for (const file of hadithFiles) {
    const rawNum = file.replace(/\.json$/, '');
    const num = parseInt(rawNum, 10);
    const cleanNum = String(num).padStart(3, '0');
    const hadithVar = `hadith_${cleanBookId}_${cleanNum}`;

    imports.push(`import ${hadithVar} from '../../assets/content/books/${bookId}/hadith/${file}';`);
    hadithMapLines.push(`    ${num}: ${hadithVar} as Hadith,`);
    totalHadiths++;
  }

  hadithEntriesByBook.push(`  '${bookId}': {\n${hadithMapLines.join('\n')}\n  },`);
}

// 3. Generate TypeScript Manifest
const manifestCode = `// Generated automatically by scripts/sync-content.mjs
// DO NOT EDIT MANUALLY

import type { Book, Hadith } from '../types/content';

${imports.join('\n')}

export const books: Record<string, Book> = {
${bookEntries.join('\n')}
};

export const booksList: Book[] = [
${booksListEntries.join('\n')}
];

export const hadiths: Record<string, Record<number, Hadith>> = {
${hadithEntriesByBook.join('\n')}
};

export function getBooks(): Book[] {
  return booksList;
}

export function getBook(bookId: string): Book | undefined {
  return books[bookId];
}

export function getHadithsForBook(bookId: string): Hadith[] {
  const bookHadiths = hadiths[bookId];
  if (!bookHadiths) return [];
  return Object.values(bookHadiths).sort((a, b) => a.number - b.number);
}

export function getHadithByNumber(bookId: string, hadithNumber: number): Hadith | undefined {
  return hadiths[bookId]?.[hadithNumber];
}
`;

fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
fs.writeFileSync(manifestFile, manifestCode, 'utf-8');

// 4. Copy narration MP3s and generate a static require map for them.
// Hadith JSON references audio as "<bookId>/<file>.mp3"; Metro needs literal imports.
fs.rmSync(targetAssetsAudioDir, { recursive: true, force: true });

const audioEntries = [];

if (fs.existsSync(contentAudioDir)) {
  for (const entry of fs.readdirSync(contentAudioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const bookId = entry.name;
    const sourceBookDir = path.join(contentAudioDir, bookId);
    const files = fs
      .readdirSync(sourceBookDir)
      .filter((f) => f.endsWith('.mp3'))
      .sort();

    if (files.length === 0) continue;

    const targetBookDir = path.join(targetAssetsAudioDir, bookId);
    fs.mkdirSync(targetBookDir, { recursive: true });

    for (const file of files) {
      fs.copyFileSync(path.join(sourceBookDir, file), path.join(targetBookDir, file));
      audioEntries.push(`${bookId}/${file}`);
    }
  }
}

const audioImports = [];
const audioMapLines = [];

for (const relPath of audioEntries) {
  const variable = `audio_${relPath.replace(/[^A-Za-z0-9]/g, '_')}`;
  audioImports.push(
    `import ${variable} from '../../assets/content/audio/${relPath}';`
  );
  audioMapLines.push(`  '${relPath}': ${variable},`);
}

const audioManifestCode = `// Generated automatically by scripts/sync-content.mjs
// DO NOT EDIT MANUALLY

${audioImports.join('\n')}

export type AudioAsset = number | string;

export const audioSources: Record<string, AudioAsset> = {
${audioMapLines.join('\n')}
};

export function getAudioAsset(relativePath: string | null | undefined): AudioAsset | undefined {
  if (!relativePath) return undefined;
  return audioSources[relativePath];
}
`;

fs.mkdirSync(path.dirname(audioManifestFile), { recursive: true });
fs.writeFileSync(audioManifestFile, audioManifestCode, 'utf-8');

console.log(`✅ Content sync complete: ${bookDirs.length} books, ${totalHadiths} hadiths.`);
console.log(`🔊 Synced ${audioEntries.length} narration file(s).`);
console.log(`📝 Generated TypeScript manifest at: ${manifestFile}`);
console.log(`📝 Generated audio manifest at: ${audioManifestFile}`);
