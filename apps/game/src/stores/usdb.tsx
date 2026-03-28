import { load } from "@tauri-apps/plugin-store";
import MiniSearch from "minisearch";
import { createRoot, createSignal } from "solid-js";
import * as v from "valibot";

import { commands, type UsdbSearchEntry } from "~/bindings";
import { createPersistentStore } from "~/lib/utils/store";

export type { UsdbSearchEntry } from "~/bindings";

const SEARCH_FIELDS = ["title", "artist", "genre", "language", "edition", "creator"] as const;

const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function buildSearchIndex(items: UsdbSearchEntry[]): MiniSearch<UsdbSearchEntry> {
  const miniSearch = new MiniSearch<UsdbSearchEntry>({
    fields: [...SEARCH_FIELDS],
    idField: "songId",
    storeFields: [],
    processTerm: (term) => normalizeText(term),
  });
  miniSearch.addAll(items);
  return miniSearch;
}

const usdbSettingsSchema = v.object({
  version: v.literal("1.0.0"),
  credentials: v.object({
    username: v.string(),
    password: v.string(),
  }),
});

type UsdbSettings = v.InferOutput<typeof usdbSettingsSchema>;

const defaultUsdbSettings: UsdbSettings = {
  version: "1.0.0",
  credentials: {
    username: "",
    password: "",
  },
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
    const store = await load(CATALOG_FILENAME);
    const catalog = ((await store.get("catalog")) as UsdbSearchEntry[] | undefined) ?? [];
    const lastMtime = ((await store.get("lastMtime")) as number | undefined) ?? 0;
    const lastSongIds = ((await store.get("lastSongIds")) as number[] | undefined) ?? [];
    return { catalog, lastMtime, lastSongIds };
  } catch {
    return { catalog: [], lastMtime: 0, lastSongIds: [] };
  }
}

async function saveCatalog(data: CatalogData): Promise<void> {
  try {
    const store = await load(CATALOG_FILENAME);
    await store.set("catalog", data.catalog);
    await store.set("lastMtime", data.lastMtime);
    await store.set("lastSongIds", data.lastSongIds);
  } catch (error) {
    console.error("Failed to save USDB catalog:", error);
  }
}

function createUsdbStore() {
  const [catalog, setCatalog] = createSignal<UsdbSearchEntry[]>([]);
  const [searchIndex, setSearchIndex] = createSignal<MiniSearch<UsdbSearchEntry>>(
    new MiniSearch({ fields: [...SEARCH_FIELDS], idField: "songId" }),
  );
  const [loggedIn, setLoggedIn] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);
  const [syncProgress, setSyncProgress] = createSignal<{ fetched: number; total: number } | null>(null);
  const [initialized, setInitialized] = createSignal(false);

  // Not reactive — only used internally for incremental sync watermark
  let lastMtime = 0;
  let lastSongIds: number[] = [];

  const updateCatalog = (items: UsdbSearchEntry[]) => {
    setCatalog(items);
    setSearchIndex(buildSearchIndex(items));
  };

  const credentials = () => usdbSettingsStore.settings().credentials;

  const setCredentials = (username: string, password: string) => {
    usdbSettingsStore.updateSettings("credentials", { username, password });
  };

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

    try {
      const result = await commands.usdbLogin(username, password);
      if (result.status === "ok" && result.data) {
        setLoggedIn(true);
        return true;
      }
    } catch (error) {
      console.error("USDB login failed:", error);
    }

    setLoggedIn(false);
    return false;
  };

  const logout = async () => {
    try {
      await commands.usdbLogout();
    } catch {
      // Ignore
    }
    setLoggedIn(false);
  };

  const syncCatalog = async (force = false) => {
    if (syncing() || !loggedIn()) return;

    setSyncing(true);
    setSyncProgress(null);

    try {
      const isFullSync = force || lastMtime === 0;
      const mtimeToSend = force ? 0 : lastMtime;
      const songIdsToSend = force ? [] : lastSongIds;

      if (isFullSync) {
        setSyncProgress({ fetched: 0, total: 27000 });
      }

      const result = await commands.usdbFetchCatalog(mtimeToSend, songIdsToSend);

      if (result.status !== "ok") {
        console.error("Catalog sync failed:", result.error);
        return;
      }

      const newEntries = result.data;

      if (isFullSync) {
        updateCatalog(newEntries);
      } else if (newEntries.length > 0) {
        const updatedMap = new Map(newEntries.map((s) => [s.songId, s]));
        const prev = catalog();
        const merged = prev.map((s) => updatedMap.get(s.songId) ?? s);
        const existingIds = new Set(prev.map((s) => s.songId));
        const brandNew = newEntries.filter((s) => !existingIds.has(s.songId));
        updateCatalog([...merged, ...brandNew]);
      }

      const allSongs = catalog();
      if (allSongs.length > 0) {
        lastMtime = Math.max(...allSongs.map((s) => s.usdbMtime));
        lastSongIds = allSongs.filter((s) => s.usdbMtime === lastMtime).map((s) => s.songId);
      }

      await saveCatalog({ catalog: catalog(), lastMtime, lastSongIds });

      if (isFullSync) {
        setSyncProgress({ fetched: allSongs.length, total: allSongs.length });
      }
    } catch (error) {
      console.error("Catalog sync error:", error);
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
    login,
    logout,
    catalog,
    searchIndex,
    initialized,
    initialize,
    syncing,
    syncProgress,
    syncCatalog,
    clearCatalog,
  };
}

export const usdbStore = createRoot(() => createUsdbStore());
export const initializeUsdbStore = () => usdbStore.initialize();
