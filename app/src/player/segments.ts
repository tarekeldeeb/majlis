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
  // A part's spoken title is shared by every hadith; it plays only before the part's own clip.
  const pushPart = (
    title: string,
    titleLabel: string,
    path: string | null | undefined,
    label: string,
    target: PlayerSection
  ) => {
    if (getAudioAsset(path) === undefined) return;
    push(title, titleLabel, target);
    push(path, label, target);
  };

  push(audio?.number, 'رقم الحديث', 'matn');
  push(audio?.matn, 'نص الحديث', 'matn');

  if (commentary.adab) {
    pushPart('titles/adab.m4a', 'الآداب', audio?.adab, 'الآداب المستفادة', 'adab');
  }
  if (commentary.fawaid) {
    pushPart('titles/fawaid.m4a', 'الفوائد', audio?.fawaid, 'الفوائد', 'fawaid');
  }
  if (commentary.meaning) {
    pushPart('titles/meaning.m4a', 'المعنى الإجمالي', audio?.meaning, 'المعنى الإجمالي', 'meaning');
  }

  // Backward compatibility with the pre-split single commentary file.
  if (!audio?.adab && !audio?.fawaid && !audio?.meaning) {
    push(audio?.commentary, 'الشرح والفوائد', 'adab');
  }

  return list;
}
