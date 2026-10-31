import { getAudioAsset, type AudioAsset } from '../data';
import { downloadedUri } from './downloads';

/** A clip as the app plays it: bundled, else downloaded from the book's dataset. */
export function resolveClip(path: string | null | undefined): AudioAsset | undefined {
  if (!path) return undefined;
  return getAudioAsset(path) ?? downloadedUri(path);
}
