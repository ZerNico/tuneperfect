import { debounce } from "@solid-primitives/scheduled";
import type { SongSummary } from "@tuneperfect/webrtc/contracts/game";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";

const SEARCH_FIELDS = ["title", "artist"] as const;

// Remove diacritics for accent-insensitive search (é -> e, ö -> o)
const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface UseSongSearchOptions {
  songs: Accessor<SongSummary[]>;
  searchQuery: Accessor<string>;
}

interface UseSongSearchResult {
  filteredSongs: Accessor<SongSummary[]>;
  debouncedSearchQuery: Accessor<string>;
}

export function useSongSearch(options: UseSongSearchOptions): UseSongSearchResult {
  const [debouncedSearchQuery, setDebouncedSearchQuery] = createSignal("");

  // Only debounce for large song lists
  const shouldDebounce = () => options.songs().length > 500;

  const debouncedSetQuery = debounce((query: string) => {
    setDebouncedSearchQuery(query);
  }, 300);

  createEffect(() => {
    if (shouldDebounce()) {
      debouncedSetQuery(options.searchQuery());
    } else {
      setDebouncedSearchQuery(options.searchQuery());
    }
  });

  // Create MiniSearch index when songs change
  const miniSearchInstance = createMemo(() => {
    const miniSearch = new MiniSearch<SongSummary>({
      fields: [...SEARCH_FIELDS],
      idField: "hash",
      storeFields: [],
      processTerm: (term) => normalizeText(term),
    });

    miniSearch.addAll(options.songs());
    return miniSearch;
  });

  const filteredSongs = createMemo(() => {
    const songs = options.songs();
    const query = debouncedSearchQuery().trim();

    if (!query) {
      return songs;
    }

    const searchResults = miniSearchInstance().search(query, {
      fuzzy: 0.2,
      prefix: true,
      combineWith: "AND", // Require all search terms to match
    });

    const hashSet = new Set(searchResults.map((r) => r.id));
    return songs.filter((song) => hashSet.has(song.hash));
  });

  return {
    filteredSongs,
    debouncedSearchQuery,
  };
}
