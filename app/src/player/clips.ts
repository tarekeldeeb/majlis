import { getAudioAsset, type AudioAsset } from '../data';
import { remoteUrl } from '../data/remote';

/** A clip as the web app plays it: bundled, else streamed from the book's dataset. */
export function resolveClip(path: string | null | undefined): AudioAsset | undefined {
  if (!path) return undefined;
  return getAudioAsset(path) ?? remoteUrl(path);
}
