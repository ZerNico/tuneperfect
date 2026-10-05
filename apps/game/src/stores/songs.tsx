import { ReactiveMap } from "@solid-primitives/map";
import type MiniSearch from "minisearch";
import { batch, createMemo, createRoot } from "solid-js";

import { createSongSearchIndex } from "~/hooks/use-song-filter";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent } from "~/lib/native/contract";
import type { LocalSong } from "~/lib/ultrastar/song";

import { settings, updateSettings } from "./settings";

const collator = new Intl.Collator();

function createSongsStore() {
  const paths = () => settings().songs.paths;

  const localSongs = new ReactiveMap<string, LocalSong[]>();

  const addSongPath = (path: string) => {
    updateSettings("songs", "paths", (prev: string[]) => (prev.includes(path) ? prev : [...prev, path]));
  };

  const removeSongPath = (path: string) => {
    updateSettings("songs", "paths", (prev: string[]) => prev.filter((p: string) => p !== path));
    localSongs.delete(path);
  };

  /** Parses the given folders that aren't loaded yet. `onProgress` sees every parse event. */
  const updateLocalSongs = async (paths: string[], onProgress?: (event: ParseSongsEvent) => void) => {
    try {
      const pathsToUpdate = paths.filter((path: string) => !localSongs.has(path));

      for await (const event of await native.songs.parse({ paths: pathsToUpdate })) {
        onProgress?.(event);
        if (event.type === "done") {
          // One library update (and search index rebuild) for all folders.
          batch(() => {
            for (const group of event.groups) {
              localSongs.set(group.path, group.songs);
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to update local songs:", error);
    }
  };

  const needsUpdate = createMemo(() => {
    const hasMissingPaths = paths().some((path: string) => !localSongs.has(path));
    return hasMissingPaths;
  });

  // Sorted by artist: the companion app lists `songs.list` (lib/webrtc/router.ts) in this order.
  const songs = createMemo(() => {
    const songs = new Map<string, LocalSong>();
    for (const [_, s] of localSongs.entries()) {
      for (const song of s) {
        songs.set(song.hash, song);
      }
    }

    return Array.from(songs.values()).toSorted((a, b) => collator.compare(a.artist, b.artist));
  });

  /** Songs by hash, for lookups that would otherwise scan the whole library (e.g. phones asking for covers). */
  const songsByHash = createMemo(() => new Map(songs().map((song) => [song.hash, song])));

  // Built on first use and then once per library change, not on every visit of the song select.
  let cachedIndex: { songs: LocalSong[]; index: MiniSearch<LocalSong> } | undefined;
  const searchIndex = () => {
    const current = songs();
    if (cachedIndex?.songs !== current) {
      cachedIndex = { songs: current, index: createSongSearchIndex(current, "hash") };
    }
    return cachedIndex.index;
  };

  return {
    paths,
    localSongs,
    addSongPath,
    removeSongPath,
    updateLocalSongs,
    needsUpdate,
    songs,
    songsByHash,
    searchIndex,
  };
}

export const songsStore = createRoot(() => createSongsStore());
