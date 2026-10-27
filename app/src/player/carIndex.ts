import type { CommentarySelection } from './segments';

// The car integrations are native-only; the web build has nothing to index.
export const writeCarIndex = async (commentary: CommentarySelection): Promise<void> => {};
