import type { Hadith, HadithAudio } from '../types/content';
import { getHadithsForBook } from './manifest';

export * from './manifest';
export * from './audio-manifest';

/** The narration clips a hadith's JSON points at, in reading order. */
export function hadithClips(audio: HadithAudio | undefined): string[] {
  return [audio?.number, audio?.matn, audio?.adab, audio?.fawaid, audio?.meaning, audio?.commentary].filter(
    (path): path is string => !!path
  );
}

const narrated = new Map<string, boolean>();

/**
 * True when the book is narrated, so the home screen can open it. Narration past the
 * bundled hadiths is streamed on the web and downloaded by the apps.
 */
export function hasAudio(bookId: string): boolean {
  let value = narrated.get(bookId);
  if (value === undefined) {
    value = getHadithsForBook(bookId).some((hadith) => !!hadith.audio?.matn);
    narrated.set(bookId, value);
  }
  return value;
}

/** The matn as read on screen: the fully diacritized text when there is one, else the source. */
export function matnText(hadith: Hadith): string {
  return hadith.matn?.diacritized || hadith.matn?.arabic || '';
}
