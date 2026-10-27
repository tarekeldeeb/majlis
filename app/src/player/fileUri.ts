import { Asset } from 'expo-asset';

/**
 * Bundled media is packed as hashed resources, which the native players and
 * the car cannot open. Downloading the asset copies it to a real file first.
 */
export async function toFileUri(source: number | string): Promise<string> {
  if (typeof source === 'string') return source;
  let asset = Asset.fromModule(source);
  // On Android, expo-asset marks bundled images as downloaded and points them at a
  // drawable resource name meant for <Image>; re-resolve them so they get copied too.
  if (asset.localUri && !asset.localUri.includes(':')) {
    asset = new Asset({ name: asset.name, type: asset.type, hash: asset.hash, uri: asset.uri });
  }
  if (!asset.localUri) {
    try {
      await asset.downloadAsync();
    } catch {
      // Fall back to the bundled URI; the player surfaces the failure.
    }
  }
  return asset.localUri ?? asset.uri;
}
