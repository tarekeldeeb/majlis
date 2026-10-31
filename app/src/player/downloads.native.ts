import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as MajlisCar from '../../modules/majlis-car/src';
import {
  getAudioAsset,
  getHadithByNumber,
  getHadithsForBook,
  hadithClips,
  remoteAudio,
  remoteDigests,
} from '../data';
import { remoteUrl } from '../data/remote';
import type { Hadith } from '../types/content';
import type { BookDownload, DownloadStatus } from './downloads';

const STORAGE_KEY = 'majlis.downloads.v1';
// Hugging Face resolves 3,000 files per address in 5 minutes: start at most 9 a second,
// and if it still answers 429, wait for the window to pass.
const REQUEST_INTERVAL_MS = 110;
const RATE_LIMIT_WAIT_MS = 60_000;
const WORKERS = 4;
// A file that keeps failing is left for the next attempt; this many failures in a row,
// with nothing arriving in between, means the device is offline.
const ATTEMPTS = 3;
const GIVE_UP_AFTER = 12;
// Downloaded hadiths join the car's list every so many files, and when a download stops.
const CAR_BATCH = 500;

// <documents>/narration/<bookId>/, kept out of device backups since it can always be
// downloaded again (on Android by plugins/withBackupRules.js).
const root = new Directory(Paths.document, 'narration');
const rootUri = root.uri.endsWith('/') ? root.uri : `${root.uri}/`;

interface Item {
  /** "<bookId>/<file>": where it lands under narration/, and a clip's path in the JSON. */
  path: string;
  url: string;
  hadith: number;
  /** A cover may be missing from the dataset; the hadith still plays without it. */
  optional?: boolean;
  attempts?: number;
}

type Intent = 'wanted' | 'paused';

const NONE: BookDownload = { status: 'idle', done: 0, total: 0 };
const books = new Map<string, BookDownload>();
const onDevice = new Map<string, Set<string>>();
// Per book, the content hash of each hadith whose files are on this device.
const digests = new Map<string, Record<string, string>>();
const queues = new Map<string, Item[]>();
const running = new Set<string>();
const listeners = new Set<() => void>();
let intents: Record<string, Intent> = {};
let carRevision = 0;
let nextSlot = 0;
let emitTimer: ReturnType<typeof setTimeout> | null = null;

const intentsLoaded = AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw) intents = { ...JSON.parse(raw), ...intents };
  })
  .catch(() => {});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function splitPath(path: string): [string, string] {
  const cut = path.indexOf('/');
  return [path.slice(0, cut), path.slice(cut + 1)];
}

/** "0051-cover.jpg" for a hadith whose clips are "0051-…". */
function coverName(hadith: Hadith): string | undefined {
  const matn = hadith.audio?.matn;
  return matn ? `${splitPath(matn)[1].split('-')[0]}-cover.jpg` : undefined;
}

/** The dataset's content hash of a hadith's files, as recorded when the app was built. */
function digestOf(bookId: string, hadith: number): string | undefined {
  const entry = remoteDigests[bookId];
  if (!entry || hadith < entry.first) return undefined;
  const hash = entry.hashes.slice((hadith - entry.first) * 4, (hadith - entry.first + 1) * 4);
  return hash.length === 4 && hash !== '....' ? hash : undefined;
}

// The book's files the app doesn't bundle: each narrated hadith's clips, then its cover.
function bookItems(bookId: string): Item[] {
  const items: Item[] = [];
  const covers = (remoteAudio[bookId]?.covers ?? 0) > 0;
  for (const hadith of getHadithsForBook(bookId)) {
    const clips = hadithClips(hadith.audio).filter((path) => getAudioAsset(path) === undefined);
    if (clips.length === 0) continue;
    for (const path of clips) items.push({ path, url: remoteUrl(path), hadith: hadith.number });
    const cover = coverName(hadith);
    if (covers && cover) {
      items.push({
        path: `${bookId}/${cover}`,
        url: remoteUrl(`${bookId}/covers/${cover}`),
        hadith: hadith.number,
        optional: true,
      });
    }
  }
  return items;
}

function digestFile(bookId: string): File {
  return new File(root, `${bookId}.json`);
}

function storedDigests(bookId: string): Record<string, string> {
  let stored = digests.get(bookId);
  if (!stored) {
    try {
      const file = digestFile(bookId);
      stored = file.exists ? (JSON.parse(file.textSync()) as Record<string, string>) : {};
    } catch {
      stored = {};
    }
    digests.set(bookId, stored);
  }
  return stored;
}

function saveDigests(bookId: string) {
  try {
    digestFile(bookId).write(JSON.stringify(storedDigests(bookId)));
  } catch {
    // Without the record the files stay; they are only re-checked if re-narrated.
  }
}

/** The book's files on this device, minus any hadith re-narrated since it was downloaded. */
function filesOf(bookId: string): Set<string> {
  let names = onDevice.get(bookId);
  if (names) return names;
  const dir = new Directory(root, bookId);
  names = new Set(
    dir.exists ? dir.list().map((entry) => entry.name).filter((name) => !name.endsWith('.part')) : []
  );
  const stored = storedDigests(bookId);
  for (const [number, digest] of Object.entries(stored)) {
    if (digest === digestOf(bookId, Number(number))) continue;
    for (const name of [...names]) {
      if (parseInt(name, 10) !== Number(number)) continue;
      names.delete(name);
      new File(dir, name).delete();
    }
    delete stored[number];
  }
  onDevice.set(bookId, names);
  return names;
}

function pendingItems(bookId: string): Item[] {
  const names = filesOf(bookId);
  return bookItems(bookId).filter((item) => !names.has(splitPath(item.path)[1]));
}

function snapshot(bookId: string): BookDownload {
  let state = books.get(bookId);
  if (!state) {
    const items = bookItems(bookId);
    const names = filesOf(bookId);
    const done = items.filter((item) => names.has(splitPath(item.path)[1])).length;
    const status: DownloadStatus = done === items.length ? 'done' : 'idle';
    state = items.length === 0 ? NONE : { status, done, total: items.length };
    books.set(bookId, state);
  }
  return state;
}

function emit() {
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = null;
  listeners.forEach((listener) => listener());
}

// Progress is published a few times a second, a change of status at once.
function update(bookId: string, patch: Partial<BookDownload>, now = false) {
  books.set(bookId, { ...snapshot(bookId), ...patch });
  if (now) emit();
  else if (!emitTimer) emitTimer = setTimeout(emit, 300);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function saveIntent(bookId: string, intent: Intent) {
  intents = { ...intents, [bookId]: intent };
  void intentsLoaded.then(() =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(intents)).catch(() => {})
  );
}

// Spaces requests out so a whole book stays under the dataset host's rate limit.
async function slot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + REQUEST_INTERVAL_MS;
  if (at > now) await sleep(at - now);
}

// A captive portal answers with its own page; keep only real audio and JPEG files.
function looksRight(file: File, name: string): boolean {
  if (file.size < 12) return false;
  const handle = file.open(FileMode.ReadOnly);
  try {
    const head = handle.readBytes(12);
    if (name.endsWith('.jpg')) return head[0] === 0xff && head[1] === 0xd8;
    return String.fromCharCode(head[4], head[5], head[6], head[7]) === 'ftyp';
  } finally {
    handle.close();
  }
}

// Downloads beside the target and renames it into place, so a cut-off transfer is
// never taken for a finished file.
async function fetchFile(item: Item): Promise<void> {
  const [bookId, name] = splitPath(item.path);
  const part = new File(root, bookId, `${name}.part`);
  await File.downloadFileAsync(item.url, part, { idempotent: true });
  if (!looksRight(part, name)) {
    part.delete();
    throw new Error(`unexpected content for ${item.path}`);
  }
  const target = new File(root, bookId, name);
  if (target.exists) target.delete();
  part.rename(name);
}

async function run(bookId: string): Promise<void> {
  running.add(bookId);
  const queue = queues.get(bookId) ?? [];
  const names = filesOf(bookId);
  const stored = storedDigests(bookId);
  // Files still to come per hadith, to record a hadith's hash once it is complete.
  const left = new Map<number, number>();
  for (const item of queue) left.set(item.hadith, (left.get(item.hadith) ?? 0) + 1);

  new Directory(root, bookId).create({ intermediates: true, idempotent: true });
  MajlisCar.excludeFromBackup(root.uri);
  update(bookId, { status: 'downloading' }, true);

  let failuresInARow = 0;
  let sinceCar = 0;

  const settle = (item: Item) => {
    const remaining = (left.get(item.hadith) ?? 1) - 1;
    left.set(item.hadith, remaining);
    const digest = digestOf(bookId, item.hadith);
    if (remaining === 0 && digest) stored[item.hadith] = digest;
  };

  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      await slot();
      try {
        await fetchFile(item);
        names.add(splitPath(item.path)[1]);
        failuresInARow = 0;
        settle(item);
        update(bookId, { done: snapshot(bookId).done + 1 });
        if (++sinceCar >= CAR_BATCH) {
          sinceCar = 0;
          saveDigests(bookId);
          carRevision += 1;
        }
      } catch (error) {
        const message = String(error);
        if (/\b429\b/.test(message)) {
          queue.unshift(item);
          nextSlot = Math.max(nextSlot, Date.now() + RATE_LIMIT_WAIT_MS);
        } else if (item.optional && /\b404\b/.test(message)) {
          settle(item);
          update(bookId, { total: snapshot(bookId).total - 1 });
        } else if (++failuresInARow >= GIVE_UP_AFTER) {
          queue.length = 0;
        } else {
          item.attempts = (item.attempts ?? 0) + 1;
          if (item.attempts < ATTEMPTS) queue.push(item);
          await sleep(1000 * failuresInARow);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: WORKERS }, worker));
  running.delete(bookId);
  queues.delete(bookId);
  saveDigests(bookId);
  carRevision += 1;
  const { done, total } = snapshot(bookId);
  const status: DownloadStatus =
    done >= total ? 'done' : intents[bookId] === 'paused' ? 'paused' : 'failed';
  update(bookId, { status }, true);
}

export function useBookDownload(bookId: string): BookDownload {
  return useSyncExternalStore(subscribe, () => snapshot(bookId));
}

/** Changes as downloaded hadiths should join the car's list. */
export function useCarRevision(): number {
  return useSyncExternalStore(subscribe, () => carRevision);
}

/** Moves a hadith, then the ones after it, to the front of the book's download. */
export function prioritize(bookId: string, hadithNumber: number): void {
  const rank = (item: Item) =>
    item.hadith >= hadithNumber ? item.hadith - hadithNumber : 1e6 + item.hadith;
  queues.get(bookId)?.sort((a, b) => rank(a) - rank(b));
}

/** Downloads the rest of a book's narration, starting with the given hadith. */
export function startDownload(bookId: string, hadithNumber?: number): void {
  saveIntent(bookId, 'wanted');
  if (running.has(bookId)) {
    if (hadithNumber !== undefined) prioritize(bookId, hadithNumber);
    return;
  }
  queues.set(bookId, pendingItems(bookId));
  if (hadithNumber !== undefined) prioritize(bookId, hadithNumber);
  void run(bookId);
}

/** Stops after the files in flight; the download resumes when asked again. */
export function pauseDownload(bookId: string): void {
  saveIntent(bookId, 'paused');
  const queue = queues.get(bookId);
  if (queue) queue.length = 0;
}

function resume() {
  void intentsLoaded.then(() => {
    for (const [bookId, intent] of Object.entries(intents)) {
      if (snapshot(bookId).status === 'done' || running.has(bookId)) continue;
      if (intent === 'paused') update(bookId, { status: 'paused' }, true);
      else startDownload(bookId);
    }
  });
}

/** Carries a download on at launch, and when the app returns to the foreground. */
export function resumeDownloads(): void {
  resume();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') resume();
  });
}

/** A downloaded file's URI, from its "<bookId>/<file>" path. */
export function downloadedUri(path: string): string | undefined {
  const [bookId, name] = splitPath(path);
  return filesOf(bookId).has(name) ? `${rootUri}${bookId}/${name}` : undefined;
}

export function downloadedCover(bookId: string, hadithNumber: number): string | undefined {
  const hadith = getHadithByNumber(bookId, hadithNumber);
  const cover = hadith && coverName(hadith);
  return cover ? downloadedUri(`${bookId}/${cover}`) : undefined;
}
