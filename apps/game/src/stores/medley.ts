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

  return {
    songs,
    setSongs,
    add,
    removeAt,
    clear,
  };
}

export const medleyStore = createMedleyStore();
