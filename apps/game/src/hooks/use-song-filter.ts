import { debounce } from "@solid-primitives/scheduled";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";

export type SortOption = "artist" | "title" | "year" | "views";
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

const includesIgnoreCase = (haystack: string | string[] | null | undefined, needle: string): boolean => {
  if (!haystack) return false;
  const values = Array.isArray(haystack) ? haystack : [haystack];
  const normalized = normalizeText(needle);
  return values.some((value) => normalizeText(value) === normalized);
};

/** Common shape for any song-like object that can be filtered/sorted. */
export interface SongLike {
  artist: string;
  title: string;
  year?: number | null;
  views?: number | null;
  genre?: string | string[] | null;
  language?: string | string[] | null;
  edition?: string | string[] | null;
  creator?: string | string[] | null;
  /** Second player (duet). Present on LocalSong; absent on online entries. */
  p2?: unknown;
}

interface UseSongFilterOptions<T extends SongLike> {
  items: Accessor<T[]>;
  sortOption: Accessor<SortOption>;
  searchQuery: Accessor<string>;
  searchFieldScope: Accessor<SearchFieldScope>;
  filters: Accessor<SongFilters>;
  /** The unique ID field on T. Defaults to "hash" (for LocalSong). Use "songId" for UsdbSearchEntry. */
  idField?: keyof T & string;
  /** Optional prebuilt MiniSearch index. If provided, skips building a new index from items. */
  searchIndex?: Accessor<MiniSearch<T>>;
}

interface UseSongFilterResult<T> {
  filteredItems: Accessor<T[]>;
  debouncedSearchQuery: Accessor<string>;
}

export function useSongFilter<T extends SongLike>(options: UseSongFilterOptions<T>): UseSongFilterResult<T> {
  const [debouncedSearchQuery, setDebouncedSearchQuery] = createSignal("");

  const shouldDebounce = () => options.items().length > 1000;

  // oxlint-disable-next-line solid/reactivity
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

  const idField = options.idField ?? ("hash" as keyof T & string);

  const ownIndex = options.searchIndex
    ? undefined
    : // oxlint-disable-next-line solid/reactivity
      createMemo(() => {
        const miniSearch = new MiniSearch<T>({
          fields: [...ALL_SEARCH_FIELDS],
          idField,
          storeFields: [],
          extractField: (document, fieldName) => {
            const value = document[fieldName as keyof T];
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

  const getIndex = () => (options.searchIndex ? options.searchIndex() : ownIndex!());

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
      songs = songs.filter((song) => song.year != null && Math.floor(song.year / 10) * 10 === decade);
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
        const searchResults = getIndex().search(query, {
          fields,
          fuzzy: 0.1,
          prefix: true,
        });
        const idSet = new Set(searchResults.map((r) => r.id));
        songs = songs.filter((song) => idSet.has(song[idField] as string | number));
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
      if (sortKey === "views") {
        return (b.views ?? 0) - (a.views ?? 0) || compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      return 0;
    });
  });

  return {
    filteredItems,
    debouncedSearchQuery,
  };
}
