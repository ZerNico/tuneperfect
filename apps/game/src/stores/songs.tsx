import { ReactiveMap } from "@solid-primitives/map";
import type MiniSearch from "minisearch";
import { batch, createMemo, createRoot, untrack } from "solid-js";

import { createSongSearchIndex } from "~/hooks/use-song-filter";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent, RescannedSongs } from "~/lib/native/contract";
import { applyFolderChanges, uniqueSongs, unpackGroups } from "~/lib/ultrastar/library-changes";
import type { LocalSong } from "~/lib/ultrastar/song";

import { medleyStore } from "./medley";
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
          const groups = unpackGroups(event);
          // One library update (and search index rebuild) for all folders.
          batch(() => {
            for (const group of groups) {
              localSongs.set(group.path, group.songs);
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to update local songs:", error);
    }
  };

  // Rescans: while something holds the library (a round is being sung), their changes wait, so
  // the song list isn't rebuilt mid-song; they're applied in one go once it's let go.
  let holds = 0;
  let rescanning = false;
  let rescanAgain = false;
  const held: RescannedSongs[] = [];

  const applyRescan = (rescan: RescannedSongs) => {
    if (rescan.groups.length === 0) return;
    const changes = applyFolderChanges(localSongs, unpackGroups(rescan));
    batch(() => {
      for (const [root, songs] of changes.roots) {
        localSongs.set(root, songs);
      }
      medleyStore.replace(changes.replaced);
    });
  };

  /**
   * Picks up songs added, changed or removed in the loaded folders since they were parsed.
   * Cheap when nothing changed: only folders whose files changed are parsed again.
   */
  const rescan = async () => {
    if (rescanning) {
      rescanAgain = true;
      return;
    }
    rescanning = true;
    try {
      do {
        rescanAgain = false;
        // The loaded folders, in the order they were parsed (`--songpath` ones included).
        const roots = untrack(() => [...localSongs.keys()]);
        if (roots.length === 0) break;
        const result = await native.songs.rescan({ paths: roots });
        if (holds > 0) held.push(result);
        else applyRescan(result);
      } while (rescanAgain);
    } catch (error) {
      console.error("Failed to rescan local songs:", error);
    } finally {
      rescanning = false;
    }
  };

  /** Keeps rescans from changing the library until the returned release is called. */
  const hold = () => {
    holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds--;
      if (holds === 0 && held.length > 0) {
        const pending = held.splice(0);
        batch(() => pending.forEach(applyRescan));
      }
    };
  };

  const needsUpdate = createMemo(() => {
    const hasMissingPaths = paths().some((path: string) => !localSongs.has(path));
    return hasMissingPaths;
  });

  // Sorted by artist: the companion app lists `songs.list` (lib/webrtc/router.ts) in this order.
  const songs = createMemo(() =>
    uniqueSongs(localSongs.values()).toSorted((a, b) => collator.compare(a.artist, b.artist)),
  );

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
    rescan,
    hold,
    needsUpdate,
    songs,
    songsByHash,
    searchIndex,
  };
}

export const songsStore = createRoot(() => createSongsStore());
