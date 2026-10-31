#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const contentBooksDir = path.resolve(appRoot, '../content/books');
const targetAssetsBooksDir = path.resolve(appRoot, 'assets/content/books');
const manifestFile = path.resolve(appRoot, 'src/data/manifest.ts');
const contentAudioDir = path.resolve(appRoot, '../content/audio');
const targetAssetsAudioDir = path.resolve(appRoot, 'assets/content/audio');
const audioManifestFile = path.resolve(appRoot, 'src/data/audio-manifest.ts');
const targetArtworkDir = path.resolve(appRoot, 'assets/content/artwork');
const artworkManifestFile = path.resolve(appRoot, 'src/data/artwork-manifest.ts');

// Every book ships the narration of its first 50 hadiths inside the app. The iOS and
// Android apps download the rest of the book and the web app streams it, both from the
// book's Hugging Face dataset.
const BUNDLED_HADITHS = 50;

// Files without a hadith number (the shared section titles) always ship.
const isBundled = (file) => !(parseInt(file, 10) > BUNDLED_HADITHS);
const isCover = (file) => /^\d+-cover\.jpg$/.test(file);

const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1';

/** The size recorded in a Git LFS pointer file, or null when the file holds its real content. */
function lfsPointerSize(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(256);
  const length = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const text = head.subarray(0, length).toString('utf8');
  if (!text.startsWith(LFS_POINTER)) return null;
  return Number(text.match(/^size (\d+)$/m)?.[1] ?? 0);
}

function fileSize(file) {
  return lfsPointerSize(file) ?? fs.statSync(file).size;
}

/** A file's content hash: its LFS oid, read from the pointer or computed the same way. */
function fileOid(file) {
  if (lfsPointerSize(file) !== null) {
    return fs.readFileSync(file, 'utf8').match(/^oid sha256:([0-9a-f]{64})$/m)[1];
  }
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Four base64 characters per hadith (from `first`, "...." where there is none) hash the
// files the apps download for it, so they fetch a hadith again once it is re-narrated.
function hadithDigests(dir, files) {
  const byHadith = new Map();
  for (const file of files) {
    const number = parseInt(file, 10);
    byHadith.set(number, [...(byHadith.get(number) ?? []), file]);
  }
  const numbers = [...byHadith.keys()].sort((a, b) => a - b);
  let hashes = '';
  for (let number = numbers[0]; number <= numbers[numbers.length - 1]; number++) {
    const group = (byHadith.get(number) ?? []).sort();
    hashes += group.length
      ? crypto
          .createHash('sha256')
          .update(group.map((file) => `${file} ${fileOid(path.join(dir, file))}`).join('\n'))
          .digest('base64url')
          .slice(0, 4)
      : '....';
  }
  return { first: numbers[0], hashes };
}

// The deploy checks out LFS pointers only; fetch the content of just the files the app
// bundles, so it never downloads the narration that stays on Hugging Face.
function fetchFromLfs(files) {
  const pointers = files.filter((file) => lfsPointerSize(file) !== null);
  if (pointers.length === 0) return;
  console.log(`⬇️  Fetching ${pointers.length} bundled file(s) from Git LFS`);
  const include = pointers.map((file) => path.relative(repoRoot, file)).join(',');
  execFileSync('git', ['lfs', 'pull', `--include=${include}`], { cwd: repoRoot, stdio: 'inherit' });
}

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

// 4. Copy narration clips and generate a static require map for them.
// Hadith JSON references audio as "<bookId>/<file>.m4a"; Metro needs literal imports.
fs.rmSync(targetAssetsAudioDir, { recursive: true, force: true });

const audioEntries = [];
const remoteLines = [];
const digestLines = [];
let remoteClips = 0;
let remoteBytes = 0;

if (fs.existsSync(contentAudioDir)) {
  for (const entry of fs.readdirSync(contentAudioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const bookId = entry.name;
    const sourceBookDir = path.join(contentAudioDir, bookId);
    const names = fs.readdirSync(sourceBookDir);
    const files = names
      // A ".part" file is a clip the generator is still writing.
      .filter((f) => f.endsWith('.m4a') && !f.includes('.part.'))
      .sort();
    const bundled = files.filter(isBundled);
    const remote = files.filter((f) => !isBundled(f));
    const remoteCovers = names.filter((f) => isCover(f) && !isBundled(f));

    if (remote.length > 0) {
      const bytes = [...remote, ...remoteCovers].reduce(
        (sum, f) => sum + fileSize(path.join(sourceBookDir, f)),
        0
      );
      remoteLines.push(
        `  '${bookId}': { clips: ${remote.length}, covers: ${remoteCovers.length}, bytes: ${bytes} },`
      );
      const { first, hashes } = hadithDigests(sourceBookDir, [...remote, ...remoteCovers]);
      digestLines.push(`  '${bookId}': { first: ${first}, hashes: '${hashes}' },`);
      remoteClips += remote.length + remoteCovers.length;
      remoteBytes += bytes;
    }
    if (bundled.length === 0) continue;

    fetchFromLfs(bundled.map((f) => path.join(sourceBookDir, f)));
    const targetBookDir = path.join(targetAssetsAudioDir, bookId);
    fs.mkdirSync(targetBookDir, { recursive: true });

    for (const file of bundled) {
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

/**
 * Narration left out of the app, per book: what the apps download (clips and car covers,
 * with their total size) and the web streams.
 */
export const remoteAudio: Record<string, { clips: number; covers: number; bytes: number }> = {
${remoteLines.join('\n')}
};

/** A content hash per downloadable hadith: 4 characters each, from hadith \`first\`. */
export const remoteDigests: Record<string, { first: number; hashes: string }> = {
${digestLines.join('\n')}
};
`;

fs.mkdirSync(path.dirname(audioManifestFile), { recursive: true });
fs.writeFileSync(audioManifestFile, audioManifestCode, 'utf-8');

// 5. Copy car artwork: a cover per hadith for Now Playing, one shared list thumbnail.
fs.rmSync(targetArtworkDir, { recursive: true, force: true });

const coverImports = [];
const coverLines = [];

if (fs.existsSync(contentAudioDir)) {
  for (const entry of fs.readdirSync(contentAudioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const bookId = entry.name;
    const covers = fs
      .readdirSync(path.join(contentAudioDir, bookId))
      .filter((f) => isCover(f) && isBundled(f))
      .sort();
    if (covers.length === 0) continue;

    fetchFromLfs(covers.map((file) => path.join(contentAudioDir, bookId, file)));
    fs.mkdirSync(path.join(targetArtworkDir, bookId), { recursive: true });
    for (const file of covers) {
      fs.copyFileSync(path.join(contentAudioDir, bookId, file), path.join(targetArtworkDir, bookId, file));
      const variable = `cover_${`${bookId}_${file}`.replace(/[^A-Za-z0-9]/g, '_')}`;
      coverImports.push(`import ${variable} from '../../assets/content/artwork/${bookId}/${file}';`);
      coverLines.push(`  '${bookId}:${parseInt(file, 10)}': ${variable},`);
    }
  }
}

const thumbnailFile = path.join(contentAudioDir, 'car', 'thumbnail.jpg');
const hasThumbnail = fs.existsSync(thumbnailFile);
if (hasThumbnail) {
  fetchFromLfs([thumbnailFile]);
  fs.mkdirSync(path.join(targetArtworkDir, 'car'), { recursive: true });
  fs.copyFileSync(thumbnailFile, path.join(targetArtworkDir, 'car', 'thumbnail.jpg'));
  coverImports.push(`import thumbnail from '../../assets/content/artwork/car/thumbnail.jpg';`);
}

const artworkManifestCode = `// Generated automatically by scripts/sync-content.mjs
// DO NOT EDIT MANUALLY

${coverImports.join('\n')}

/** Now Playing artwork per hadith, keyed by "<bookId>:<number>". */
export const coverSources: Record<string, number> = {
${coverLines.join('\n')}
};

/** The list thumbnail shared by every hadith in the car. */
export const thumbnailSource: number | undefined = ${hasThumbnail ? 'thumbnail' : 'undefined'};
`;

fs.writeFileSync(artworkManifestFile, artworkManifestCode, 'utf-8');

console.log(`✅ Content sync complete: ${bookDirs.length} books, ${totalHadiths} hadiths.`);
console.log(`🔊 Synced ${audioEntries.length} narration file(s).`);
if (remoteClips > 0) {
  console.log(`☁️  Left ${remoteClips} file(s) (${Math.round(remoteBytes / 1e6)} MB) to Hugging Face.`);
}
console.log(`🖼  Synced ${coverLines.length} cover(s)${hasThumbnail ? ' and the car thumbnail' : ''}.`);
console.log(`📝 Generated TypeScript manifest at: ${manifestFile}`);
console.log(`📝 Generated audio manifest at: ${audioManifestFile}`);
