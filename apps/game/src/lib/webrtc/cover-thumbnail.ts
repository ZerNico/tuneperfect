/** Edge length of the square thumbnails sent to phones; covers show at ~48px there (2-3x for sharp displays). */
const THUMBNAIL_SIZE = 160;

// One render per cover; a failed or missing cover is cached as null too.
const cache = new Map<string, Promise<string | null>>();

/**
 * A small JPEG data URL of a cover, for the companion app. Phones can't reach the game's local media
 * server, so covers travel over the data channel; downscaled they're a few KB each.
 */
export function coverThumbnail(coverUrl: string): Promise<string | null> {
  let thumbnail = cache.get(coverUrl);
  if (!thumbnail) {
    thumbnail = render(coverUrl).catch(() => null);
    cache.set(coverUrl, thumbnail);
  }
  return thumbnail;
}

async function render(coverUrl: string): Promise<string | null> {
  const response = await fetch(coverUrl);
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob());

  // Cover-crop to a square, like the covers are shown everywhere else.
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    THUMBNAIL_SIZE,
    THUMBNAIL_SIZE,
  );
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
