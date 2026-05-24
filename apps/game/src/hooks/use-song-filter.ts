import { debounce } from "@solid-primitives/scheduled";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";

import type { LocalSong } from "~/lib/ultrastar/song";

export type SortOption = "artist" | "title" | "year";
export type SearchFieldScope = "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator";

export type SongTypeFilter = "all" | "solo" | "duet";

export interface SongFilters {
  type: SongTypeFilter;
  decade: number | null;
  genre: string | null;
  language: string | null;
  edition: string | null;
}

export const DEFAULT_FILTERS: SongFilters = {
  type: "all",
  decade: null,
  genre: null,
  language: null,
  edition: null,
};

export const countActiveFilters = (filters: SongFilters): number => {
  let count = 0;
  if (filters.type !== "all") count++;
  if (filters.decade !== null) count++;
  if (filters.genre !== null) count++;
  if (filters.language !== null) count++;
  if (filters.edition !== null) count++;
  return count;
};

const ALL_SEARCH_FIELDS = ["title", "artist", "genre", "language", "edition", "creator"] as const;

const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const compare = (a: string, b: string) => collator.compare(a, b);

// Remove diacritics for accent-insensitive search (é -> e, ö -> o)
const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const includesIgnoreCase = (haystack: string[] | null, needle: string): boolean => {
  if (!haystack) return false;
  const normalized = normalizeText(needle);
  return haystack.some((value) => normalizeText(value) === normalized);
};

interface UseSongFilterOptions {
  items: Accessor<LocalSong[]>;
  sortOption: Accessor<SortOption>;
  searchQuery: Accessor<string>;
  searchFieldScope: Accessor<SearchFieldScope>;
  filters: Accessor<SongFilters>;
}

interface UseSongFilterResult {
  filteredItems: Accessor<LocalSong[]>;
  debouncedSearchQuery: Accessor<string>;
}

export function useSongFilter(options: UseSongFilterOptions): UseSongFilterResult {
  const [debouncedSearchQuery, setDebouncedSearchQuery] = createSignal("");

  const shouldDebounce = () => options.items().length > 1000;

  const debouncedSetQuery = debounce((query: string) => {
    setDebouncedSearchQuery(query);
  }, 500);

  createEffect(() => {
    if (shouldDebounce()) {
      debouncedSetQuery(options.searchQuery());
    } else {
      setDebouncedSearchQuery(options.searchQuery());
    }
  });

  // Index all fields, filter at search time for better performance
  const miniSearchInstance = createMemo(() => {
    const miniSearch = new MiniSearch<LocalSong>({
      fields: [...ALL_SEARCH_FIELDS],
      idField: "hash",
      storeFields: [],
      extractField: (document, fieldName) => {
        const value = document[fieldName as keyof LocalSong];
        if (Array.isArray(value)) {
          return value.join(" ");
        }
        return value as string | undefined;
      },
      processTerm: (term) => normalizeText(term),
    });

    miniSearch.addAll(options.items());
    return miniSearch;
  });

  const filteredItems = createMemo(() => {
    let songs = options.items();
    const filters = options.filters();
    const query = debouncedSearchQuery().trim();
    const scope = options.searchFieldScope();

    // Library filters apply independently of and before the text search
    if (filters.type === "duet") {
      songs = songs.filter((song) => song.p2 !== null);
    } else if (filters.type === "solo") {
      songs = songs.filter((song) => song.p2 === null);
    }

    if (filters.decade !== null) {
      const decade = filters.decade;
      songs = songs.filter((song) => song.year !== null && Math.floor(song.year / 10) * 10 === decade);
    }

    if (filters.genre !== null) {
      songs = songs.filter((song) => includesIgnoreCase(song.genre, filters.genre as string));
    }

    if (filters.language !== null) {
      songs = songs.filter((song) => includesIgnoreCase(song.language, filters.language as string));
    }

    if (filters.edition !== null) {
      songs = songs.filter((song) => includesIgnoreCase(song.edition, filters.edition as string));
    }

    if (query) {
      if (scope === "year") {
        const yearQuery = Number.parseInt(query, 10);
        if (!Number.isNaN(yearQuery)) {
          songs = songs.filter((song) => song.year === yearQuery);
        } else {
          songs = [];
        }
      } else {
        const fields = scope === "all" ? undefined : [scope];
        const searchResults = miniSearchInstance().search(query, {
          fields,
          fuzzy: 0.1,
          prefix: true,
        });
        const hashSet = new Set(searchResults.map((r) => r.id));
        songs = songs.filter((song) => hashSet.has(song.hash));
      }
    }

    if (songs.length === 0) {
      return [];
    }

    return [...songs].toSorted((a, b) => {
      const sortKey = options.sortOption();
      if (sortKey === "artist") {
        return compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      if (sortKey === "title") {
        return compare(a.title, b.title);
      }
      if (sortKey === "year") {
        return (a.year ?? 0) - (b.year ?? 0) || compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      return 0;
    });
  });

  return {
    filteredItems,
    debouncedSearchQuery,
  };
}
