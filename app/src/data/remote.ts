// A book's narration past the hadiths bundled with the app lives in its own Hugging Face
// dataset, quranquiznet/majlis-<bookId>: the clips at its root, car covers under covers/.
const DATASETS = 'https://huggingface.co/datasets/quranquiznet/majlis-';

/** The dataset URL of a file given as "<bookId>/<path in the dataset>". */
export function remoteUrl(path: string): string {
  const cut = path.indexOf('/');
  return `${DATASETS}${path.slice(0, cut)}/resolve/main/${path.slice(cut + 1)}`;
}
