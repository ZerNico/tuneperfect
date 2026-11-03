import { ReactiveMap } from "@solid-primitives/map";
import type MiniSearch from "minisearch";
import { batch, createMemo, createRoot, createSignal, untrack } from "solid-js";

import { createSongSearchIndex } from "~/hooks/use-song-filter";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent, RescannedSongs } from "~/lib/native/contract";
import { applyFolderChanges, uniqueSongs, unpackGroups } from "~/lib/ultrastar/library-changes";
import type { LocalSong } from "~/lib/ultrastar/song";

import { medleyStore } from "./medley";
import { settings, updateSettings } from "./settings";

const collator = new Intl.Collator();

/** How often the library is checked for changes on its own (besides on focus and in the song select). */
const RESCAN_INTERVAL_MS = 60_000;
/** When a folder was still being copied, how soon to look again. */
const RESCAN_RETRY_MS = 4_000;

function createSongsStore() {
  const paths = () => settings().songs.paths;

  const localSongs = new ReactiveMap<string, LocalSong[]>();
  /** Folders the library was asked to load: the ones not loaded yet (gone at the time) are retried. */
  const wantedRoots = new Set<string>();
  /** Loaded folders that are gone right now (e.g. an unplugged drive): their songs are hidden. */
  const [missingRoots, setMissingRoots] = createSignal<ReadonlySet<string>>(new Set());

  const addSongPath = (path: string) => {
    updateSettings("songs", "paths", (prev: string[]) => (prev.includes(path) ? prev : [...prev, path]));
  };

  const removeSongPath = (path: string) => {
    updateSettings("songs", "paths", (prev: string[]) => prev.filter((p: string) => p !== path));
    wantedRoots.delete(path);
    localSongs.delete(path);
  };

  /** Parses the given folders that aren't loaded yet. `onProgress` sees every parse event. */
  const updateLocalSongs = async (paths: string[], onProgress?: (event: ParseSongsEvent) => void) => {
    try {
      for (const path of paths) wantedRoots.add(path);
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

  // Rescans: while something holds the library (a round is being sung), they wait (and changes of
  // one already running are kept back), so the song list isn't rebuilt mid-song; it all happens
  // once it's let go.
  let holds = 0;
  let rescanning = false;
  let rescanAgain = false;
  let rescanWanted = false;
  const held: RescannedSongs[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watching = false;

  const applyRescan = (rescan: RescannedSongs) => {
    const missing = new Set(rescan.missingRoots);
    const missingChanged =
      missing.size !== missingRoots().size || [...missing].some((root) => !missingRoots().has(root));
    if (rescan.groups.length === 0 && !missingChanged) return;
    const changes = applyFolderChanges(localSongs, unpackGroups(rescan));
    batch(() => {
      for (const [root, songs] of changes.roots) {
        localSongs.set(root, songs);
      }
      if (missingChanged) setMissingRoots(missing);
      medleyStore.replace(changes.replaced);
    });
  };

  /** Folders that couldn't be loaded before (e.g. a drive that wasn't plugged in), if they're back. */
  const loadReturnedRoots = async () => {
    const unloaded = [...wantedRoots].filter((root) => !untrack(() => localSongs.has(root)));
    if (unloaded.length === 0) return;
    const granted = new Set(await native.app.grantSongFolders());
    const returned = unloaded.filter((root) => granted.has(root));
    if (returned.length > 0) await updateLocalSongs(returned);
  };

  /**
   * Picks up songs added, changed or removed in the loaded folders since they were parsed, and
   * loads folders that are back. Cheap when nothing changed: only folders whose files changed
   * are parsed again.
   */
  const rescan = async () => {
    if (holds > 0) {
      rescanWanted = true;
      return;
    }
    if (rescanning) {
      rescanAgain = true;
      return;
    }
    rescanning = true;
    let pending = false;
    try {
      do {
        rescanAgain = false;
        await loadReturnedRoots();
        // The loaded folders, in the order they were parsed (`--songpath` ones included).
        const roots = untrack(() => [...localSongs.keys()]);
        if (roots.length === 0) break;
        for await (const result of await native.songs.rescan({ paths: roots })) {
          pending = result.pending;
          if (holds > 0) held.push(result);
          else applyRescan(result);
        }
      } while (rescanAgain);
    } catch (error) {
      console.error("Failed to rescan local songs:", error);
    } finally {
      rescanning = false;
      if (watching) {
        clearTimeout(timer);
        timer = setTimeout(() => void rescan(), pending ? RESCAN_RETRY_MS : RESCAN_INTERVAL_MS);
      }
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
      if (holds > 0) return;
      if (held.length > 0) {
        const pending = held.splice(0);
        batch(() => pending.forEach(applyRescan));
      }
      if (rescanWanted) {
        rescanWanted = false;
        void rescan();
      }
    };
  };

  /**
   * Keeps the library in sync with the song folders from now on: a rescan whenever the window
   * gets focus (songs were probably added in another app) and every minute.
   */
  const watch = () => {
    if (watching) return;
    watching = true;
    window.addEventListener("focus", () => void rescan());
    timer = setTimeout(() => void rescan(), RESCAN_INTERVAL_MS);
  };

  const needsUpdate = createMemo(() => {
    const hasMissingPaths = paths().some((path: string) => !localSongs.has(path));
    return hasMissingPaths;
  });

  // Sorted by artist: the companion app lists `songs.list` (lib/webrtc/router.ts) in this order.
  const songs = createMemo(() => {
    const missing = missingRoots();
    const available = [...localSongs.entries()].filter(([root]) => !missing.has(root)).map(([, songs]) => songs);
    return uniqueSongs(available).toSorted((a, b) => collator.compare(a.artist, b.artist));
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
    rescan,
    hold,
    watch,
    needsUpdate,
    songs,
    songsByHash,
    searchIndex,
  };
}

export const songsStore = createRoot(() => createSongsStore());
