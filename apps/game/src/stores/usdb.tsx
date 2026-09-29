import type MiniSearch from "minisearch";
import { batch, createRoot, createSignal } from "solid-js";
import * as v from "valibot";

import { createSongSearchIndex } from "~/hooks/use-song-filter";
import { native, safe } from "~/lib/native/client";
import type { UsdbSearchEntry } from "~/lib/native/types.gen";
import { createPersistentStore } from "~/lib/utils/store";

export type { UsdbSearchEntry } from "~/lib/native/types.gen";

const buildSearchIndex = (items: UsdbSearchEntry[]) => createSongSearchIndex(items, "songId");

const usdbSettingsSchema = v.object({
  version: v.literal("1.0.0"),
  credentials: v.object({
    username: v.string(),
    password: v.string(),
  }),
  loggedIn: v.optional(v.boolean(), false),
  catalogCount: v.optional(v.number(), 0),
});

type UsdbSettings = v.InferOutput<typeof usdbSettingsSchema>;

const defaultUsdbSettings: UsdbSettings = {
  version: "1.0.0",
  credentials: {
    username: "",
    password: "",
  },
  loggedIn: false,
  catalogCount: 0,
};

const usdbSettingsStore = createPersistentStore({
  filename: "usdb-settings.json",
  schema: usdbSettingsSchema,
  defaults: defaultUsdbSettings,
});

// Catalog stored in a separate file (~15MB) to avoid slowing down the settings store
const CATALOG_FILENAME = "usdb-catalog.json";

interface CatalogData {
  catalog: UsdbSearchEntry[];
  lastMtime: number;
  lastSongIds: number[];
}

async function loadCatalog(): Promise<CatalogData> {
  try {
    const data = (await native.store.read({ file: CATALOG_FILENAME })) as Partial<CatalogData> | null;
    return { catalog: data?.catalog ?? [], lastMtime: data?.lastMtime ?? 0, lastSongIds: data?.lastSongIds ?? [] };
  } catch {
    return { catalog: [], lastMtime: 0, lastSongIds: [] };
  }
}

async function saveCatalog(data: CatalogData): Promise<void> {
  try {
    await native.store.write({ file: CATALOG_FILENAME, data: { ...data } });
  } catch (error) {
    console.error("Failed to save USDB catalog:", error);
  }
}

function createUsdbStore() {
  const [catalog, setCatalog] = createSignal<UsdbSearchEntry[]>([]);
  const [searchIndex, setSearchIndex] = createSignal<MiniSearch<UsdbSearchEntry>>(buildSearchIndex([]));

  const loggedIn = () => usdbSettingsStore.settings().loggedIn;
  const setLoggedIn = (value: boolean) => usdbSettingsStore.updateSettings("loggedIn", value);
  const [sessionActive, setSessionActive] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);
  const [syncProgress, setSyncProgress] = createSignal<{ fetched: number; total: number } | null>(null);
  const [initialized, setInitialized] = createSignal(false);

  // Not reactive — only used internally for incremental sync watermark
  let lastMtime = 0;
  let lastSongIds: number[] = [];

  const catalogCount = () => usdbSettingsStore.settings().catalogCount;

  const updateCatalog = (items: UsdbSearchEntry[]) => {
    batch(() => {
      setCatalog(items);
      setSearchIndex(buildSearchIndex(items));
    });
    usdbSettingsStore.updateSettings("catalogCount", items.length);
  };

  /** Applies an incremental sync: changed songs are replaced in place, new ones appended. */
  const mergeIntoCatalog = (entries: UsdbSearchEntry[]) => {
    const index = searchIndex();
    const prev = catalog();
    const existingIds = new Set(prev.map((s) => s.songId));
    const changed = new Map<number, UsdbSearchEntry>();
    const brandNew = new Map<number, UsdbSearchEntry>();
    for (const entry of entries) {
      if (existingIds.has(entry.songId)) {
        changed.set(entry.songId, entry);
        index.replace(entry);
      } else {
        brandNew.set(entry.songId, entry);
      }
    }
    index.addAll([...brandNew.values()]);

    const merged = [...prev.map((s) => changed.get(s.songId) ?? s), ...brandNew.values()];
    // The index was updated in place; the new catalog array tells readers to search again.
    setCatalog(merged);
    usdbSettingsStore.updateSettings("catalogCount", merged.length);
  };

  const credentials = () => usdbSettingsStore.settings().credentials;

  const setCredentials = (username: string, password: string) => {
    usdbSettingsStore.updateSettings("credentials", { username, password });
    setLoggedIn(false);
    setSessionActive(false);
  };

  const initializeSettings = () => usdbSettingsStore.initialize();

  const initialize = async () => {
    await usdbSettingsStore.initialize();

    const data = await loadCatalog();
    updateCatalog(data.catalog);
    lastMtime = data.lastMtime;
    lastSongIds = data.lastSongIds;

    setInitialized(true);
  };

  const login = async (): Promise<boolean> => {
    const { username, password } = credentials();
    if (!username || !password) return false;

    const [error, success, isDefined] = await safe(native.usdb.login({ username, password }));
    if (!error && success) {
      setLoggedIn(true);
      setSessionActive(true);
      return true;
    }
    if (!error || isDefined) {
      // Rejected by USDB (or its response couldn't be understood): the creds are bad.
      setLoggedIn(false);
    } else {
      // Transport error — keep the persisted flag, creds may still be valid.
      console.error("USDB login failed:", error);
    }

    setSessionActive(false);
    return false;
  };

  const logout = async () => {
    try {
      await native.usdb.logout();
    } catch {
      // Ignore
    }
    setCredentials("", "");
  };

  /** Fetches new and changed songs (everything on the first or a forced sync). Resolves whether it succeeded. */
  const syncCatalog = async (force = false): Promise<boolean> => {
    if (syncing() || !sessionActive()) return false;

    setSyncing(true);
    setSyncProgress(null);

    try {
      const isFullSync = force || lastMtime === 0;
      const mtimeToSend = force ? 0 : lastMtime;
      const songIdsToSend = force ? [] : lastSongIds;

      if (isFullSync) {
        setSyncProgress({ fetched: 0, total: 27000 });
      }

      let newEntries: UsdbSearchEntry[] = [];
      // Progress arrives per fetched page, then the entries.
      for await (const event of await native.usdb.fetchCatalog({
        lastMtime: mtimeToSend,
        lastSongIds: songIdsToSend,
      })) {
        if (event.type === "progress") {
          setSyncProgress({ fetched: event.fetched, total: event.total });
        } else {
          newEntries = event.catalog;
        }
      }

      if (!isFullSync && newEntries.length === 0) return true;

      if (isFullSync) {
        updateCatalog(newEntries);
      } else {
        mergeIntoCatalog(newEntries);
      }

      const allSongs = catalog();
      let maxMtime = 0;
      for (const song of allSongs) {
        if (song.usdbMtime > maxMtime) maxMtime = song.usdbMtime;
      }
      lastMtime = maxMtime;
      lastSongIds = allSongs.filter((s) => s.usdbMtime === lastMtime).map((s) => s.songId);

      await saveCatalog({ catalog: allSongs, lastMtime, lastSongIds });

      if (isFullSync) {
        setSyncProgress({ fetched: allSongs.length, total: allSongs.length });
      }
      return true;
    } catch (error) {
      console.error("Catalog sync error:", error);
      return false;
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const clearCatalog = async () => {
    updateCatalog([]);
    lastMtime = 0;
    lastSongIds = [];
    await saveCatalog({ catalog: [], lastMtime: 0, lastSongIds: [] });
  };

  return {
    credentials,
    setCredentials,
    loggedIn,
    sessionActive,
    login,
    logout,
    catalog,
    catalogCount,
    searchIndex,
    initialized,
    initializeSettings,
    initialize,
    syncing,
    syncProgress,
    syncCatalog,
    clearCatalog,
  };
}

export const usdbStore = createRoot(() => createUsdbStore());
export const initializeUsdbStore = () => usdbStore.initializeSettings();
