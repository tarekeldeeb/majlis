import { coverSources, thumbnailSource } from '../data/artwork-manifest';
import { toFileUri } from './fileUri';

/** The hadith's Now Playing artwork, as a file the native players can open. */
export async function coverUri(bookId: string, hadithNumber: number): Promise<string | undefined> {
  const source = coverSources[`${bookId}:${hadithNumber}`];
  return source === undefined ? undefined : toFileUri(source);
}

/** The list thumbnail shared by every hadith in the car. */
export async function thumbnailUri(): Promise<string | undefined> {
  return thumbnailSource === undefined ? undefined : toFileUri(thumbnailSource);
}
