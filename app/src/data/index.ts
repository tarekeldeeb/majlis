import type { Hadith } from '../types/content';
import { audioSources } from './audio-manifest';

export * from './manifest';
export * from './audio-manifest';

/** True when the book actually ships narration, so the home screen can gate it. */
export function hasAudio(bookId: string): boolean {
  return Object.keys(audioSources).some((path) => path.startsWith(`${bookId}/`));
}

/** The matn as read on screen: the fully diacritized text when there is one, else the source. */
export function matnText(hadith: Hadith): string {
  return hadith.matn?.diacritized || hadith.matn?.arabic || '';
}
