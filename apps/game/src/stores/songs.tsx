import { ReactiveMap } from "@solid-primitives/map";
import { makePersisted } from "@solid-primitives/storage";
import { createMemo, createSignal } from "solid-js";
import { type LocalSong, parseLocalFileTree } from "~/lib/ultrastar/parser/local";
import { readFileTree } from "~/lib/utils/fs";

function createSongsStore() {
  const [paths, setPaths] = makePersisted(createSignal<string[]>([]), { name: "songsStore.paths" });
  const localSongs = new ReactiveMap<string, LocalSong[]>();

  const addSongPath = (path: string) => {
    setPaths((prev) => [...prev, path]);
  };

  const removeSongPath = (path: string) => {
    setPaths((prev) => prev.filter((p) => p !== path));

    localSongs.delete(path);
  };

  const updateLocalSongs = async () => {
    try {
      for (const path of paths()) {
        if (!localSongs.has(path)) {
          const root = await readFileTree(path);
          const songs = await parseLocalFileTree(root);
          localSongs.set(path, songs);
        }
      }
    } catch (error) {}
  };

  const needsUpdate = createMemo(() => {
    const hasMissingPaths = paths().some((path) => !localSongs.has(path));

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
