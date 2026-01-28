import { debounce } from "@solid-primitives/scheduled";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";
import type { LocalSong } from "~/lib/ultrastar/song";

export type SortOption = "artist" | "title" | "year";
export type SearchFilter = "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator";

const ALL_SEARCH_FIELDS = ["title", "artist", "genre", "language", "edition", "creator"] as const;

const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const compare = (a: string, b: string) => collator.compare(a, b);

// Remove diacritics for accent-insensitive search (é -> e, ö -> o)
const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface UseSongFilterOptions {
  items: Accessor<LocalSong[]>;
  sort: Accessor<SortOption>;
  searchQuery: Accessor<string>;
  searchFilter: Accessor<SearchFilter>;
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
    const query = debouncedSearchQuery().trim();

    if (query) {
      const filter = options.searchFilter();

      if (filter === "year") {
        const yearQuery = Number.parseInt(query, 10);
        if (!Number.isNaN(yearQuery)) {
          songs = songs.filter((song) => song.year === yearQuery);
        } else {
          songs = [];
        }
      } else {
        const fields = filter === "all" ? undefined : [filter];
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

    return [...songs].sort((a, b) => {
      const sort = options.sort();
      if (sort === "artist") {
        return compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      if (sort === "title") {
        return compare(a.title, b.title);
      }
      if (sort === "year") {
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
