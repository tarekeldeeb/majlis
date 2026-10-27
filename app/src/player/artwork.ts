// Car artwork is native-only; keeping it out of the web bundle spares the
// Pages build 43 images it never shows.
export const coverUri = async (
  bookId: string,
  hadithNumber: number
): Promise<string | undefined> => undefined;

export const thumbnailUri = async (): Promise<string | undefined> => undefined;
