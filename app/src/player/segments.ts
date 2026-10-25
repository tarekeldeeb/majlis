import { getAudioAsset, type AudioAsset } from '../data';
import type { HadithAudio } from '../types/content';

export type PlayerSection = 'matn' | 'adab' | 'fawaid' | 'meaning';

export interface Segment {
  source: AudioAsset;
  label: string;
  target: PlayerSection;
}

export interface CommentarySelection {
  adab: boolean;
  fawaid: boolean;
  meaning: boolean;
}

/** The ordered narration for one hadith, honouring the chosen commentary parts. */
export function buildSegments(
  audio: HadithAudio | undefined,
  commentary: CommentarySelection
): Segment[] {
  const list: Segment[] = [];
  const push = (path: string | null | undefined, label: string, target: PlayerSection) => {
    const source = getAudioAsset(path);
    if (source !== undefined) list.push({ source, label, target });
  };

  push(audio?.number, 'رقم الحديث', 'matn');
  push(audio?.matn, 'نص الحديث', 'matn');

  if (commentary.adab) {
    push('titles/adab.mp3', 'الآداب', 'adab');
    push(audio?.adab, 'الآداب المستفادة', 'adab');
  }
  if (commentary.fawaid) {
    push('titles/fawaid.mp3', 'الفوائد', 'fawaid');
    push(audio?.fawaid, 'الفوائد', 'fawaid');
  }
  if (commentary.meaning) {
    push('titles/meaning.mp3', 'المعنى الإجمالي', 'meaning');
    push(audio?.meaning, 'المعنى الإجمالي', 'meaning');
  }

  // Backward compatibility with the pre-split single commentary file.
  if (!audio?.adab && !audio?.fawaid && !audio?.meaning) {
    push(audio?.commentary, 'الشرح والفوائد', 'adab');
  }

  return list;
}
