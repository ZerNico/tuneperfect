import { createSignal } from "solid-js";

import type { Song } from "~/lib/ultrastar/song";

export type SelectionMode = "single" | "medley";

/**
 * Stages songs for the `/sing/select` screen instead of passing them as URL
 * params, so local and online (non-hashable) songs are handled uniformly.
 */
function createSelectionStore() {
  const [songs, setSongs] = createSignal<Song[]>([]);
  const [mode, setMode] = createSignal<SelectionMode>("single");

  const set = (nextSongs: Song[], nextMode: SelectionMode = "single") => {
    setSongs(nextSongs);
    setMode(nextMode);
  };

  const clear = () => {
    setSongs([]);
    setMode("single");
  };

  return {
    songs,
    mode,
    set,
    clear,
  };
}

export const selectionStore = createSelectionStore();
