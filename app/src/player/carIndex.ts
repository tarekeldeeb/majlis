import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { formatHadithTitle } from '../constants/theme';
import type { AudioAsset } from '../data';
import { getBooks, getHadithsForBook } from '../data';
import { buildSegments } from './segments';

// The car browses without React, so the resolved file URIs are persisted here.
const ALL_COMMENTARY = { adab: true, fawaid: true, meaning: true };

async function resolveUri(source: AudioAsset): Promise<string> {
  if (typeof source === 'string') return source;
  const asset = Asset.fromModule(source);
  if (!asset.localUri) {
    try {
      await asset.downloadAsync();
    } catch {
      // Leave the bundled URI; the player reports the failure.
    }
  }
  return asset.localUri ?? asset.uri;
}

export async function writeCarIndex(): Promise<boolean> {
  const entries = [];

  for (const book of getBooks()) {
    for (const hadith of getHadithsForBook(book.id)) {
      const segments = buildSegments(hadith.audio, ALL_COMMENTARY);
      if (segments.length === 0) continue;

      const resolved = [];
      for (const segment of segments) {
        resolved.push({ uri: await resolveUri(segment.source), title: segment.label });
      }

      entries.push({
        id: `${book.id}:${hadith.number}`,
        title: formatHadithTitle(hadith.number),
        artist: book.title,
        segments: resolved,
      });
    }
  }

  const file = new File(Paths.document, 'car-index.json');
  file.write(JSON.stringify({ version: 1, hadiths: entries }));
  return true;
}
