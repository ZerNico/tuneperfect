import { ReactiveMap } from "@solid-primitives/map";
import { makePersisted } from "@solid-primitives/storage";
import { createMemo, createSignal } from "solid-js";
import { collectSongFiles, type LocalSong, parseAllSongFiles } from "~/lib/ultrastar/parser/local";
import { readFileTree } from "~/lib/utils/fs";
import { tauriStorage } from "~/lib/utils/storage";

export const storage = tauriStorage("songs.json", { autoSave: true });

function createSongsStore() {
  const [paths, setPaths] = makePersisted(createSignal<string[]>([]), { name: "paths", storage });
  const localSongs = new ReactiveMap<string, LocalSong[]>();

  const addSongPath = (path: string) => {
    setPaths((prev) => [...prev, path]);
  };

  const removeSongPath = (path: string) => {
    setPaths((prev) => prev.filter((p) => p !== path));
    localSongs.delete(path);
  };

  const updateLocalSongs = async (
    paths: string[],
    onProgress?: (currentSong: string, progress: number) => void
  ) => {
    try {
      const allSongFiles = [];
      
      for (const path of paths) {
        if (!localSongs.has(path)) {
          const root = await readFileTree(path);
          const songFiles = collectSongFiles(root, path);
          allSongFiles.push(...songFiles);
        }
      }

      if (allSongFiles.length === 0) {
        onProgress?.("", 1);
        return;
      }

      const { songsByPath } = await parseAllSongFiles(allSongFiles, (progress) => {
        onProgress?.(progress.currentSong, progress.current / progress.total);
      });

      for (const [path, songs] of songsByPath.entries()) {
        localSongs.set(path, songs);
      }

      onProgress?.("", 1);
    } catch (error) {
      console.error("Failed to update local songs:", error);
      onProgress?.("", 1);
    }
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
