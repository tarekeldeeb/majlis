import { audioSources } from './audio-manifest';

export * from './manifest';
export * from './audio-manifest';

/** True when the book actually ships narration, so the home screen can gate it. */
export function hasAudio(bookId: string): boolean {
  return Object.keys(audioSources).some((path) => path.startsWith(`${bookId}/`));
}
