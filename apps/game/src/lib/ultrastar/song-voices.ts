import { native } from "~/lib/native/client";

import type { LocalSong } from "./song";

/**
 * The scanned library only carries song metadata (every note of every song would be gigabytes
 * across IPC for a big library), so a song's voices are loaded when something needs them: a round
 * that's about to start, or a preview looking for its chorus. Recently used ones stay cached.
 */
const CACHE_SIZE = 32;
const cache = new Map<string, Promise<LocalSong["voices"]>>();

const loadVoices = (song: LocalSong) => {
  const cached = cache.get(song.txtPath);
  if (cached) {
    // Most recently used goes last.
    cache.delete(song.txtPath);
    cache.set(song.txtPath, cached);
    return cached;
  }

  const loading = native.songs.voices({ txtPath: song.txtPath });
  cache.set(song.txtPath, loading);
  // A failed load shouldn't stay cached.
  loading.catch(() => cache.delete(song.txtPath));
  if (cache.size > CACHE_SIZE) {
    cache.delete(cache.keys().next().value!);
  }
  return loading;
};

/** The song with its voices, loading them if the library entry doesn't have them. */
export async function withVoices(song: LocalSong): Promise<LocalSong> {
  if (song.voices.length > 0 || song.voiceCount === 0) {
    return song;
  }
  return { ...song, voices: await loadVoices(song) };
}
