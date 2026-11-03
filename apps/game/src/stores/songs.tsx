import { ReactiveMap } from "@solid-primitives/map";
import type MiniSearch from "minisearch";
import { batch, createMemo, createRoot, createSignal } from "solid-js";

import { createSongSearchIndex } from "~/hooks/use-song-filter";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent, RescannedSongs } from "~/lib/native/contract";
import type { SongGroup } from "~/lib/native/types.gen";
import { applyFolderChanges, uniqueSongs, unpackGroups } from "~/lib/ultrastar/library-changes";
import { createRescanScheduler } from "~/lib/ultrastar/rescan-scheduler";
import type { LocalSong } from "~/lib/ultrastar/song";

import { medleyStore } from "./medley";
import { settings, updateSettings } from "./settings";

const collator = new Intl.Collator();

/** How often the library is checked for changes on its own (besides on focus and in the song select). */
const RESCAN_INTERVAL_MS = 60_000;
/** When folders were still being copied, how soon to look again (doubling while they still are). */
const RESCAN_RETRY_MS = 2_000;
/** Focusing the window again this soon after a rescan doesn't start another one. */
const RESCAN_MIN_GAP_MS = 10_000;

type ParsedGroup = ReturnType<typeof unpackGroups<SongGroup>>[number];

/** One rescan: folders that are back (parsed in full) and changes in the loaded ones. */
interface LibraryUpdate {
  parsed: ParsedGroup[];
  rescan: RescannedSongs | null;
}

/** The one event of a stream that carries a single result (streamed only to keep binary data binary). */
async function onlyEvent<T>(events: AsyncIterable<T>): Promise<T> {
  for await (const event of events) return event;
  throw new Error("The stream ended without a result");
}

function createSongsStore() {
  const paths = () => settings().songs.paths;

  const localSongs = new ReactiveMap<string, LocalSong[]>();
  /** Folders the library was asked to load: the ones not loaded yet (gone at the time) are retried. */
  const wantedRoots = new Set<string>();
  /** Folders being parsed right now: neither parsed again nor forgotten by a rescan meanwhile. */
  const parsingRoots = new Set<string>();
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

  /** Parses the given folders; the ones that can't be read are left out. */
  const parseRoots = async (paths: string[], onProgress?: (event: ParseSongsEvent) => void) => {
    for (const path of paths) parsingRoots.add(path);
    try {
      for await (const event of await native.songs.parse({ paths })) {
        onProgress?.(event);
        if (event.type === "done") return unpackGroups(event);
      }
      return [];
    } finally {
      for (const path of paths) parsingRoots.delete(path);
    }
  };

  /** Parses the given folders that aren't loaded yet. `onProgress` sees every parse event. */
  const updateLocalSongs = async (paths: string[], onProgress?: (event: ParseSongsEvent) => void) => {
    try {
      for (const path of paths) wantedRoots.add(path);
      const pathsToUpdate = paths.filter((path) => !localSongs.has(path) && !parsingRoots.has(path));
      const groups = await parseRoots(pathsToUpdate, onProgress);
      // One library update (and search index rebuild) for all folders.
      batch(() => {
        for (const group of groups) {
          localSongs.set(group.path, group.songs);
        }
      });
    } catch (error) {
      console.error("Failed to update local songs:", error);
    }
  };

  /** Wanted folders that couldn't be loaded before (e.g. a drive that wasn't plugged in) and are back. */
  const returnedRoots = async () => {
    const unloaded = [...wantedRoots].filter((root) => !localSongs.has(root) && !parsingRoots.has(root));
    if (unloaded.length === 0) return [];
    const granted = new Set(await native.app.grantSongFolders());
    return unloaded.filter((root) => granted.has(root));
  };

  const runRescan = async (): Promise<LibraryUpdate> => {
    const parsed = await parseRoots(await returnedRoots());
    // Every folder the native side knows, in the order they were parsed: the loaded ones
    // (`--songpath` ones included), and the ones parsed but not applied yet.
    const roots = [...new Set([...localSongs.keys(), ...parsingRoots, ...parsed.map((group) => group.path)])];
    const rescan = roots.length > 0 ? await onlyEvent(await native.songs.rescan({ paths: roots })) : null;
    return { parsed, rescan };
  };

  const applyUpdates = (updates: LibraryUpdate[]) => {
    batch(() => {
      for (const { parsed, rescan } of updates) {
        // Folders removed in the settings meanwhile stay removed.
        for (const group of parsed) {
          if (wantedRoots.has(group.path)) localSongs.set(group.path, group.songs);
        }
        if (!rescan) continue;

        const missing = new Set(rescan.missingRoots);
        const current = missingRoots();
        if (missing.size !== current.size || [...missing].some((root) => !current.has(root))) {
          setMissingRoots(missing);
        }
        if (rescan.groups.length === 0) continue;
        const changes = applyFolderChanges(localSongs, unpackGroups(rescan));
        for (const [root, songs] of changes.roots) {
          localSongs.set(root, songs);
        }
        medleyStore.replace(changes.replaced);
      }
    });
  };

  // Changes found while the library is held (a song is being sung) wait until it's let go, so the
  // song list isn't rebuilt mid-song.
  const scheduler = createRescanScheduler<LibraryUpdate>({
    run: runRescan,
    apply: applyUpdates,
    isPending: (update) => update.rescan?.pending ?? false,
    onError: (error) => console.error("Failed to rescan local songs:", error),
    interval: RESCAN_INTERVAL_MS,
    retry: RESCAN_RETRY_MS,
    minGap: RESCAN_MIN_GAP_MS,
  });

  /**
   * Picks up songs added, changed or removed in the loaded folders since they were parsed, and
   * loads folders that are back. Cheap when nothing changed: only folders whose files changed
   * are parsed again.
   */
  const rescan = () => scheduler.request();

  const onFocus = () => void scheduler.request({ throttle: true });

  /**
   * Keeps the library in sync with the song folders from now on: a rescan whenever the window
   * gets focus (songs were probably added in another app) and every minute.
   */
  const watch = () => {
    window.removeEventListener("focus", onFocus);
    window.addEventListener("focus", onFocus);
    scheduler.start();
  };

  const unwatch = () => {
    window.removeEventListener("focus", onFocus);
    scheduler.stop();
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
      // Keyed like the song select identifies songs (`getId` in screens/sing/index.tsx).
      cachedIndex = { songs: current, index: createSongSearchIndex(current, "txtPath") };
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
    /** Keeps rescans from changing the library until the returned release is called. */
    hold: scheduler.hold,
    watch,
    unwatch,
    needsUpdate,
    songs,
    songsByHash,
    searchIndex,
  };
}

export const songsStore = createRoot(() => createSongsStore());

// A hot-reloaded store would leave the old one's focus listener and timer behind.
import.meta.hot?.dispose(() => songsStore.unwatch());
