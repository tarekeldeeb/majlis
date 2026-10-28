export type ReviewStatus = 'ingested' | 'draft' | 'approved';

export interface RelatedAyah {
  ref: string;
  text: string;
}

export interface HadithMatn {
  arabic: string;
  sourceId?: number;
  /** Fully diacritized reading text derived from `arabic`, when the pipeline produced one. */
  diacritized?: string | null;
}

export interface HadithCommentary {
  adab?: string[];
  fawaid?: string[];
  meaning?: string | null;
  relatedAyat?: RelatedAyah[];
  sources?: string[];
}

export interface HadithAudio {
  number?: string | null;
  matn?: string | null;
  adab?: string | null;
  fawaid?: string | null;
  meaning?: string | null;
  commentary?: string | null;
}

export interface HadithReview {
  status: ReviewStatus;
  reviewers?: string[];
  approvedAt?: string | null;
  notes?: string;
}

export interface Chapter {
  id: number;
  title: string;
}

export interface Hadith {
  id: string;
  book: string;
  number: number;
  chapter?: Chapter;
  matn: HadithMatn;
  commentary: HadithCommentary;
  audio?: HadithAudio;
  review: HadithReview;
}

export interface BookSource {
  repo?: string;
  url?: string;
  bookId?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  count: number;
  chapters?: Chapter[];
  source?: BookSource;
}

export interface BookWithHadiths {
  book: Book;
  hadiths: Hadith[];
}
