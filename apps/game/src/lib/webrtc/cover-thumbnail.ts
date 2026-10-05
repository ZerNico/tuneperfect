import type { CoverThumbnailRequest, CoverThumbnailResponse } from "./cover-thumbnail.worker";

/** Thumbnails kept in memory (~10 KB each); beyond that the least recently used are dropped and re-rendered on demand. */
const CACHE_LIMIT = 500;

// One render per cover; a failed or missing cover is cached as null too. A Map keeps insertion order, so
// re-inserting on use makes the first entry the least recently used.
const cache = new Map<string, Promise<string | null>>();

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, (dataUrl: string | null) => void>();

/** Started on the first request, so the game pays nothing until a phone browses songs. */
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./cover-thumbnail.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<CoverThumbnailResponse>) => {
      pending.get(event.data.id)?.(event.data.dataUrl);
      pending.delete(event.data.id);
    });
  }
  return worker;
}

/**
 * A small JPEG data URL of a cover, for the companion app. Phones can't reach the game's local media
 * server, so covers travel over the data channel; downscaled they're a few KB each. Rendered in a worker
 * (see cover-thumbnail.worker.ts), so it never takes time from the game's main thread.
 */
export function coverThumbnail(coverUrl: string): Promise<string | null> {
  let thumbnail = cache.get(coverUrl);
  if (thumbnail) {
    cache.delete(coverUrl);
    cache.set(coverUrl, thumbnail);
  } else {
    thumbnail = new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- worker messages have no target origin
      getWorker().postMessage({ id, coverUrl } satisfies CoverThumbnailRequest);
    });
    cache.set(coverUrl, thumbnail);
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  return thumbnail;
}
