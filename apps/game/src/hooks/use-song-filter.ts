import { debounce } from "@solid-primitives/scheduled";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";

export type SortOption = "artist" | "title" | "year" | "views";
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

/** Common shape for any song-like object that can be filtered/sorted. */
interface SongLike {
  artist: string;
  title: string;
  year?: number | null;
  views?: number | null;
  genre?: string | string[] | null;
  language?: string | string[] | null;
  edition?: string | string[] | null;
  creator?: string | string[] | null;
}

interface UseSongFilterOptions<T extends SongLike> {
  items: Accessor<T[]>;
  sortOption: Accessor<SortOption>;
  searchQuery: Accessor<string>;
  searchFilter: Accessor<SearchFilter>;
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
    : createMemo(() => {
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
