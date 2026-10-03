/**
 * Renders cover thumbnails for the companion app off the main thread: fetch, decode, crop-scale and
 * JPEG-encode all happen here, so phones browsing songs never cost the game a frame.
 */

/** Edge length of the square thumbnails; covers show at ~48px on phones (2-3x for sharp displays). */
const THUMBNAIL_SIZE = 160;

export interface CoverThumbnailRequest {
  id: number;
  coverUrl: string;
}

export interface CoverThumbnailResponse {
  id: number;
  dataUrl: string | null;
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

// The project's types are the DOM's (Window.postMessage wants a target origin); a worker posts without one.
// oxlint-disable-next-line unicorn/require-post-message-target-origin -- worker messages have no target origin
const post = (message: CoverThumbnailResponse) => (self as unknown as Worker).postMessage(message);

self.addEventListener("message", async (event: MessageEvent<CoverThumbnailRequest>) => {
  const { id, coverUrl } = event.data;
  const dataUrl = await render(coverUrl).catch(() => null);
  post({ id, dataUrl });
});
