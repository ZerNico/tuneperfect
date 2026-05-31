import type { SongLike } from "~/hooks/use-song-filter";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Normalize a facet field (scalar string, string array, or null) to a string array. */
const toStringArray = (value: string | string[] | null | undefined): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const collectStringValues = (
  songs: SongLike[],
  pick: (song: SongLike) => string | string[] | null | undefined,
): string[] => {
  const set = new Set<string>();
  for (const song of songs) {
    for (const value of toStringArray(pick(song))) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        set.add(trimmed);
      }
    }
  }
  return Array.from(set).toSorted((a, b) => collator.compare(a, b));
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
