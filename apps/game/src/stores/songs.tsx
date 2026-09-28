import { ReactiveMap } from "@solid-primitives/map";
import { createMemo } from "solid-js";

import { native } from "~/lib/native/client";
import type { ParseSongsEvent } from "~/lib/native/contract";
import type { LocalSong } from "~/lib/ultrastar/song";

import { settings, updateSettings } from "./settings";

function createSongsStore() {
  const paths = () => settings().songs.paths;

  const localSongs = new ReactiveMap<string, LocalSong[]>();

  const addSongPath = (path: string) => {
    updateSettings("songs", "paths", (prev: string[]) => [...prev, path]);
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
          for (const group of event.groups) {
            localSongs.set(group.path, group.songs);
          }
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

  const songs = createMemo(() => {
    const songs = new Map<string, LocalSong>();
    for (const [_, s] of localSongs.entries()) {
      for (const song of s) {
        songs.set(song.hash, song);
      }
    }

    return Array.from(songs.values()).toSorted((a, b) => a.artist.localeCompare(b.artist));
  });

  return {
    paths,
    localSongs,
    addSongPath,
    removeSongPath,
    updateLocalSongs,
    needsUpdate,
    songs,
  };
}

export const songsStore = createSongsStore();
