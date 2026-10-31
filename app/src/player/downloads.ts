// The web app streams the narration it doesn't bundle, so it never downloads any.

export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'failed' | 'done';

export interface BookDownload {
  status: DownloadStatus;
  /** The book's downloadable files on this device, out of `total`. */
  done: number;
  total: number;
}

const NONE: BookDownload = { status: 'idle', done: 0, total: 0 };

export const useBookDownload = (bookId: string): BookDownload => NONE;

/** Changes as downloaded hadiths should join the car's list. */
export const useCarRevision = (): number => 0;

export const startDownload = (bookId: string, hadithNumber?: number): void => {};

export const pauseDownload = (bookId: string): void => {};

export const prioritize = (bookId: string, hadithNumber: number): void => {};

export const resumeDownloads = (): void => {};

export const downloadedUri = (path: string): string | undefined => undefined;

export const downloadedCover = (bookId: string, hadithNumber: number): string | undefined =>
  undefined;
