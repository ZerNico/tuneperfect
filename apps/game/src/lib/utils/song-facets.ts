import type { LocalSong } from "~/lib/ultrastar/song";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

const collectStringValues = (songs: LocalSong[], pick: (song: LocalSong) => string[] | null): string[] => {
  const set = new Set<string>();
  for (const song of songs) {
    const values = pick(song);
    if (!values) continue;
    for (const value of values) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        set.add(trimmed);
      }
    }
  }
  return Array.from(set).toSorted((a, b) => collator.compare(a, b));
};

export const getGenres = (songs: LocalSong[]): string[] => collectStringValues(songs, (song) => song.genre);

export const getLanguages = (songs: LocalSong[]): string[] => collectStringValues(songs, (song) => song.language);

export const getEditions = (songs: LocalSong[]): string[] => collectStringValues(songs, (song) => song.edition);

/**
 * Returns the available decades (in years, e.g. 1980) found in the song library, sorted ascending.
 */
export const getDecades = (songs: LocalSong[]): number[] => {
  const set = new Set<number>();
  for (const song of songs) {
    if (song.year === null) continue;
    set.add(Math.floor(song.year / 10) * 10);
  }
  return Array.from(set).toSorted((a, b) => a - b);
};

export const formatDecade = (decade: number): string => `${decade}s`;
