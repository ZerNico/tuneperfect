import { ReactiveMap } from "@solid-primitives/map";
import { createMemo } from "solid-js";
import { commands } from "~/bindings";
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

  const updateLocalSongs = async (paths: string[]) => {
    try {
      const pathsToUpdate = paths.filter((path: string) => !localSongs.has(path));

      const result = await commands.parseSongsFromPaths(pathsToUpdate);

      console.log(result);

      if (result.status === "error") {
        console.error("Failed to update local songs:", result.error);
        return;
      }

      for (const group of result.data) {
        localSongs.set(group.path, group.songs);
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

    return Array.from(songs.values()).sort((a, b) => a.artist.localeCompare(b.artist));
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
