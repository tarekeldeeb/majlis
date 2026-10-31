import { hadithClips, type AudioAsset } from '../data';
import type { HadithAudio } from '../types/content';
import { resolveClip } from './clips';

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

/**
 * The ordered narration for one hadith, honouring the chosen commentary parts. Empty
 * until every clip of the hadith is at hand (bundled, downloaded or streamed), so a
 * download in progress never starts a hadith with parts missing.
 */
export function buildSegments(
  audio: HadithAudio | undefined,
  commentary: CommentarySelection
): Segment[] {
  if (hadithClips(audio).some((path) => resolveClip(path) === undefined)) return [];

  const list: Segment[] = [];
  const push = (path: string | null | undefined, label: string, target: PlayerSection) => {
    const source = resolveClip(path);
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
    if (resolveClip(path) === undefined) return;
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
