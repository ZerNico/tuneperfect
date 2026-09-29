import type { SongLike, SongTypeFilter } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Lower-case and strip diacritics for accent-insensitive matching (é -> e, ö -> o). */
export const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type FacetValue = string | string[] | null | undefined;

/**
 * The individual values of a facet field: arrays and comma lists
 * ("Pop, Dance-Pop") are split, trimmed and emptied of blanks.
 */
export const splitFacetValues = (value: FacetValue): string[] => {
  if (!value) return [];
  const result: string[] = [];
  for (const entry of Array.isArray(value) ? value : [value]) {
    for (const part of entry.split(",")) {
      const trimmed = part.trim();
      if (trimmed) result.push(trimmed);
    }
  }
  return result;
};

/** Facet fields are often comma lists ("Pop, Dance-Pop, …"); for a short label the first entry is enough. */
export const firstFacetValue = (value: FacetValue): string | undefined => splitFacetValues(value)[0];

interface FacetKeys {
  genre: string[];
  language: string[];
  edition: string[];
}

// Songs are immutable once loaded, so their normalised facet values are computed once.
const facetKeysCache = new WeakMap<SongLike, FacetKeys>();

/** Normalised individual genre, language and edition values of a song, for matching filters. */
export const facetKeys = (song: SongLike): FacetKeys => {
  let keys = facetKeysCache.get(song);
  if (!keys) {
    const normalized = (value: FacetValue) => splitFacetValues(value).map(normalizeText);
    keys = { genre: normalized(song.genre), language: normalized(song.language), edition: normalized(song.edition) };
    facetKeysCache.set(song, keys);
  }
  return keys;
};

/**
 * Every distinct value of a facet, deduplicated case- and accent-insensitively.
 * Each option is shown in its most common spelling.
 */
const collectStringValues = (songs: SongLike[], pick: (song: SongLike) => FacetValue): string[] => {
  const spellings = new Map<string, Map<string, number>>();
  for (const song of songs) {
    for (const value of splitFacetValues(pick(song))) {
      const key = normalizeText(value);
      let counts = spellings.get(key);
      if (!counts) spellings.set(key, (counts = new Map()));
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const result: string[] = [];
  for (const counts of spellings.values()) {
    let best = "";
    let bestCount = 0;
    for (const [spelling, count] of counts) {
      if (count > bestCount) {
        best = spelling;
        bestCount = count;
      }
    }
    result.push(best);
  }
  return result.toSorted((a, b) => collator.compare(a, b));
};

export const getGenres = (songs: SongLike[]): string[] => collectStringValues(songs, (song) => song.genre);

export const getLanguages = (songs: SongLike[]): string[] => collectStringValues(songs, (song) => song.language);

export const getEditions = (songs: SongLike[]): string[] => collectStringValues(songs, (song) => song.edition);

/**
 * Returns the available decades (in years, e.g. 1980) found in the song library, sorted ascending.
 */
export const getDecades = (songs: SongLike[]): number[] => {
  const set = new Set<number>();
  for (const song of songs) {
    if (song.year == null) continue;
    set.add(Math.floor(song.year / 10) * 10);
  }
  return Array.from(set).toSorted((a, b) => a - b);
};

export const formatDecade = (decade: number): string => `${decade}s`;

export const typeLabel = (value: SongTypeFilter): string => {
  if (value === "duet") return t("sing.filter.duet");
  if (value === "solo") return t("sing.filter.solo");
  return t("sing.filter.any");
};
