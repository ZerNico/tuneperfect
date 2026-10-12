/**
 * URLs of media the main process serves on `media://` (`electron/protocols/media.ts`).
 * Shared by the renderer, which builds sample URLs, and the main process, which serves them.
 */
export const MEDIA_SCHEME = "media";

/** Files from the granted song folders: `media://local/<encoded absolute path>`. */
export const SONG_FILES_HOST = "local";
export const SONG_FILES_BASE_URL = `${MEDIA_SCHEME}://${SONG_FILES_HOST}`;

/** USDB audio samples, streamed from their upstream URL: `media://usdb-sample/<encoded URL>`. */
export const USDB_SAMPLE_HOST = "usdb-sample";

export function usdbSampleUrl(sampleUrl: string): string {
  // Some catalog entries carry stray whitespace around the URL.
  return `${MEDIA_SCHEME}://${USDB_SAMPLE_HOST}/${encodeURIComponent(sampleUrl.trim())}`;
}
