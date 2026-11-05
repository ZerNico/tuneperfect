import type { LocalSong as ScannedSong, SongDirGroup } from "~/lib/native/types.gen";

import type { LocalSong } from "./song";

/** The packed notes the native side sends songs with (see `ParseSongsEvent`). */
export interface PackedGroups<G extends { songs: unknown[] }> {
  groups: G[];
  notes: Uint8Array;
  noteRanges: Uint32Array;
}

/** Gives each song its notes: a view into the one buffer they all came in. */
export function unpackGroups<G extends { songs: ScannedSong[] }>(
  packed: PackedGroups<G>,
): (Omit<G, "songs"> & { songs: LocalSong[] })[] {
  let range = 0;
  return packed.groups.map((group) => ({
    ...group,
    songs: group.songs.map((song): LocalSong => {
      const offset = packed.noteRanges[range++]!;
      const length = packed.noteRanges[range++]!;
      return { ...song, notes: packed.notes.subarray(offset, offset + length) };
    }),
  }));
}

export interface LibraryChanges {
  /** The new song lists of the roots that changed. */
  roots: Map<string, LocalSong[]>;
  /** Every song that was in a changed folder, by song file: its new version, or null if it's gone. */
  replaced: Map<string, LocalSong | null>;
}

/**
 * Applies rescanned folders to the library: each folder's songs replace what it had before.
 * Folders of roots that aren't in the library (any more) are ignored.
 */
export function applyFolderChanges(
  library: ReadonlyMap<string, LocalSong[]>,
  groups: (Omit<SongDirGroup, "songs"> & { songs: LocalSong[] })[],
): LibraryChanges {
  const byRoot = new Map<string, { dirs: Set<string>; added: LocalSong[] }>();
  for (const group of groups) {
    if (!library.has(group.root)) continue;
    let entry = byRoot.get(group.root);
    if (!entry) {
      entry = { dirs: new Set(), added: [] };
      byRoot.set(group.root, entry);
    }
    entry.dirs.add(group.dir);
    entry.added.push(...group.songs);
  }

  const roots = new Map<string, LocalSong[]>();
  const replaced = new Map<string, LocalSong | null>();
  for (const [root, { dirs, added }] of byRoot) {
    const kept: LocalSong[] = [];
    for (const song of library.get(root)!) {
      if (dirs.has(song.songDir)) replaced.set(song.txtPath, null);
      else kept.push(song);
    }
    for (const song of added) replaced.set(song.txtPath, song);
    roots.set(root, [...kept, ...added]);
  }
  return { roots, replaced };
}

/**
 * The library's songs, one per hash (the same song can be in several folders): the one with the
 * first song file in code-point order, so which copy plays doesn't depend on rescan order.
 */
export function uniqueSongs(roots: Iterable<LocalSong[]>): LocalSong[] {
  const byHash = new Map<string, LocalSong>();
  for (const songs of roots) {
    for (const song of songs) {
      const current = byHash.get(song.hash);
      if (!current || song.txtPath < current.txtPath) byHash.set(song.hash, song);
    }
  }
  return Array.from(byHash.values());
}
