import { File, Paths } from 'expo-file-system';
import * as MajlisCar from '../../modules/majlis-car/src';
import { formatHadithTitle } from '../constants/theme';
import { getBooks, getHadithsForBook } from '../data';
import { coverUri, thumbnailUri } from './artwork';
import { toFileUri } from './fileUri';
import { buildSegments, type CommentarySelection } from './segments';

// The car browses without React, so the resolved file URIs are persisted here.
// It follows the reader's commentary choices so car and phone queues line up.
export async function writeCarIndex(commentary: CommentarySelection): Promise<void> {
  const thumbnail = await thumbnailUri();
  const entries = [];

  for (const book of getBooks()) {
    for (const hadith of getHadithsForBook(book.id)) {
      const segments = buildSegments(hadith.audio, commentary);
      // The shared section titles come with every hadith; only its own matn means it is narrated.
      if (!segments.some((segment) => segment.target === 'matn')) continue;

      const resolved = [];
      for (const segment of segments) {
        resolved.push({ uri: await toFileUri(segment.source), title: segment.label });
      }

      entries.push({
        id: `${book.id}:${hadith.number}`,
        title: formatHadithTitle(hadith.number),
        artist: book.title,
        artworkUri: await coverUri(book.id, hadith.number),
        thumbnailUri: thumbnail,
        segments: resolved,
      });
    }
  }

  new File(Paths.document, 'car-index.json').write(JSON.stringify({ version: 1, hadiths: entries }));
  // A car may already be connected and showing the list from the previous index.
  MajlisCar.reloadLibrary();
}
