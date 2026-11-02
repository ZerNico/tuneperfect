import { createSignal } from "solid-js";

import type { LocalSong } from "~/lib/ultrastar/song";

function createMedleyStore() {
  const [songs, setSongs] = createSignal<LocalSong[]>([]);

  const add = (song: LocalSong) => {
    setSongs((prev) => [...prev, song]);
  };

  const removeAt = (index: number) => {
    setSongs((prev) => prev.filter((_, i) => i !== index));
  };

  const clear = () => {
    setSongs([]);
  };

  /** Follows library changes: songs by song file, with their new version or null if they're gone. */
  const replace = (replaced: ReadonlyMap<string, LocalSong | null>) => {
    if (replaced.size === 0 || !songs().some((song) => replaced.has(song.txtPath))) return;
    setSongs((prev) =>
      prev.flatMap((song) => {
        const next = replaced.has(song.txtPath) ? replaced.get(song.txtPath) : song;
        return next ? [next] : [];
      }),
    );
  };

  return {
    songs,
    add,
    removeAt,
    clear,
    replace,
  };
}

export const medleyStore = createMedleyStore();
