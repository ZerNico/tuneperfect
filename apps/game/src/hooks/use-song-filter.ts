import { debounce } from "@solid-primitives/scheduled";
import MiniSearch from "minisearch";
import { type Accessor, createEffect, createMemo, createSignal, on, untrack } from "solid-js";

import { facetKeys, normalizeText } from "~/lib/utils/song-facets";

export type SortOption = "artist" | "title" | "year" | "date" | "views";
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

/** Common shape for any song-like object that can be filtered/sorted. */
export interface SongLike {
  artist: string;
  title: string;
  year?: number | null;
  views?: number | null;
  /** File creation date in ms since epoch. Present on LocalSong; absent on online entries. */
  createdAt?: number | null;
  genre?: string | string[] | null;
  language?: string | string[] | null;
  edition?: string | string[] | null;
  creator?: string | string[] | null;
  /** Number of sung parts; more than one is a duet. Present on LocalSong; absent on online entries (never duets here). */
  voiceCount?: number | null;
}

export const isDuet = (song: SongLike) => (song.voiceCount ?? 0) > 1;

const SEARCH_FIELDS = ["title", "artist", "genre", "language", "edition", "creator"] as const;

const defaultTokenize = MiniSearch.getDefault("tokenize") as (text: string, fieldName?: string) => string[];
const APOSTROPHES = /['’`ʼ]/g;

/** Accent-insensitive full-text index over the searchable song fields. Build it once per library. */
export function createSongSearchIndex<T extends SongLike>(items: T[], idField: keyof T & string): MiniSearch<T> {
  const index = new MiniSearch<T>({
    fields: [...SEARCH_FIELDS],
    idField,
    storeFields: [],
    extractField: (document, fieldName) => {
      const value = document[fieldName as keyof T];
      return Array.isArray(value) ? value.join(" ") : (value as string | undefined);
    },
    // "Don't" is one word ("dont"), not "don" and "t": every word of a query has to match, so a
    // split word would make "dont stop" find nothing. Queries go through the same tokenizer.
    tokenize: (text) => defaultTokenize(text.replace(APOSTROPHES, ""), undefined),
    processTerm: normalizeText,
  });
  index.addAll(items);
  return index;
}

/** Ids of the songs matching `query`, in `scope` (any search field but the year). */
export function searchSongIds<T>(index: MiniSearch<T>, query: string, scope: Exclude<SearchFieldScope, "year">) {
  const results = index.search(query, {
    fields: scope === "all" ? undefined : [scope],
    // Every word has to match (in any field), so "queen bohemian" narrows down instead of listing
    // every Queen song and everything "bohemian".
    combineWith: "AND",
    fuzzy: 0.1,
    prefix: true,
  });
  return new Set(results.map((result) => String(result.id)));
}

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Collation rank of each item's key (equal keys share a rank), so sorting compares integers. */
function collationRanks<T>(items: T[], key: (item: T) => string): Int32Array {
  const keys = items.map(key);
  const order = keys.map((_, index) => index).toSorted((a, b) => collator.compare(keys[a]!, keys[b]!));
  const ranks = new Int32Array(items.length);
  let rank = 0;
  for (let i = 0; i < order.length; i++) {
    if (i > 0 && collator.compare(keys[order[i - 1]!]!, keys[order[i]!]!) !== 0) rank++;
    ranks[order[i]!] = rank;
  }
  return ranks;
}

/** Everything the sort options compare, computed once per library. */
interface SortKeys {
  artist: Int32Array;
  title: Int32Array;
  year: Float64Array;
  createdAt: Float64Array;
  views: Float64Array;
}

function computeSortKeys(items: SongLike[]): SortKeys {
  return {
    artist: collationRanks(items, (item) => item.artist),
    title: collationRanks(items, (item) => item.title),
    year: Float64Array.from(items, (item) => item.year ?? 0),
    createdAt: Float64Array.from(items, (item) => item.createdAt ?? 0),
    views: Float64Array.from(items, (item) => item.views ?? 0),
  };
}

/** Item indices in the order of `sortOption`; name ties fall back to artist, then title. */
// The library array only changes when songs are (re)loaded, but the browser is rebuilt on every
// visit: keep its sort keys and sorted orders per array, so entering the song select doesn't
// re-collate tens of thousands of titles each time.
const sortCache = new WeakMap<readonly SongLike[], { keys: SortKeys; sorted: Map<SortOption, readonly SongLike[]> }>();

function cachedSort<T extends SongLike>(items: T[], sortOption: SortOption): T[] {
  let entry = sortCache.get(items);
  if (!entry) {
    entry = { keys: computeSortKeys(items), sorted: new Map() };
    sortCache.set(items, entry);
  }
  let sorted = entry.sorted.get(sortOption);
  if (!sorted) {
    sorted = sortedIndices(entry.keys, sortOption).map((index) => items[index]!);
    entry.sorted.set(sortOption, sorted);
  }
  return sorted as T[];
}

function sortedIndices(keys: SortKeys, sortOption: SortOption): number[] {
  const { artist, title, year, createdAt, views } = keys;
  const byName = (a: number, b: number) => artist[a]! - artist[b]! || title[a]! - title[b]!;
  const compare: (a: number, b: number) => number =
    sortOption === "title"
      ? (a, b) => title[a]! - title[b]! || artist[a]! - artist[b]!
      : sortOption === "year"
        ? (a, b) => year[a]! - year[b]! || byName(a, b)
        : sortOption === "date"
          ? (a, b) => createdAt[b]! - createdAt[a]! || byName(a, b)
          : sortOption === "views"
            ? (a, b) => views[b]! - views[a]! || byName(a, b)
            : byName;
  return Array.from(artist, (_, index) => index).toSorted(compare);
}

/** Search queries are only debounced for libraries this large. */
const DEBOUNCE_THRESHOLD = 1000;

interface UseSongFilterOptions<T extends SongLike> {
  items: Accessor<T[]>;
  getId: (item: T) => string;
  /** Prebuilt index over `items` (see `createSongSearchIndex`). */
  searchIndex: Accessor<MiniSearch<T>>;
  sortOption: Accessor<SortOption>;
  searchQuery: Accessor<string>;
  searchFieldScope: Accessor<SearchFieldScope>;
  filters: Accessor<SongFilters>;
}

/**
 * Sorts the library once per sort option, then filters the sorted list, so
 * typing and changing filters never re-sort. Results keep the sort order.
 */
export function useSongFilter<T extends SongLike>(options: UseSongFilterOptions<T>): Accessor<T[]> {
  // Starts from the current query: a browser that keeps its search must not flash unfiltered.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = createSignal(untrack(options.searchQuery));

  // oxlint-disable-next-line solid/reactivity
  const debouncedSetQuery = debounce(setDebouncedSearchQuery, 500);

  createEffect(
    on(
      options.searchQuery,
      (query) => {
        // Clearing applies at once; only typing into large libraries waits.
        if (query.trim() && options.items().length > DEBOUNCE_THRESHOLD) {
          debouncedSetQuery(query);
        } else {
          debouncedSetQuery.clear();
          setDebouncedSearchQuery(query);
        }
      },
      { defer: true },
    ),
  );

  const sortedItems = createMemo(() => cachedSort(options.items(), options.sortOption()));

  return createMemo(() => {
    const songs = sortedItems();
    const filters = options.filters();
    const query = debouncedSearchQuery().trim();
    const scope = options.searchFieldScope();

    // Library filters apply independently of the text search.
    const predicates: ((song: T) => boolean)[] = [];

    if (filters.type !== "all") {
      const duet = filters.type === "duet";
      predicates.push((song) => isDuet(song) === duet);
    }

    if (filters.decade !== null) {
      const decade = filters.decade;
      predicates.push((song) => song.year != null && Math.floor(song.year / 10) * 10 === decade);
    }

    for (const facet of ["genre", "language", "edition"] as const) {
      const value = filters[facet];
      if (value === null) continue;
      const needle = normalizeText(value);
      predicates.push((song) => facetKeys(song)[facet].includes(needle));
    }

    if (query) {
      if (scope === "year") {
        const year = Number.parseInt(query, 10);
        if (Number.isNaN(year)) return [];
        predicates.push((song) => song.year === year);
      } else {
        const ids = searchSongIds(options.searchIndex(), query, scope);
        predicates.push((song) => ids.has(options.getId(song)));
      }
    }

    if (predicates.length === 0) return songs;
    return songs.filter((song) => predicates.every((predicate) => predicate(song)));
  });
}
