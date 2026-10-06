export type { UsdbSong } from "~/lib/native/types.gen";

import type { LocalSong as ScannedSong, UsdbSong } from "~/lib/native/types.gen";

/** A song from the library. Its `voices` stay empty until unpacked from `notes` (see `withVoices`). */
export type LocalSong = ScannedSong & {
  /** The song's voices, packed (see `packed-notes.ts`). */
  notes: Uint8Array;
};

export type Song = LocalSong | UsdbSong;

export function isUsdbSong(song: Song): song is UsdbSong {
  return "songId" in song && "audioYoutubeId" in song;
}

export function isLocalSong(song: Song): song is LocalSong {
  return "audioUrl" in song;
}

/** How many voices a song has (2+ is a duet). Library songs carry their voices packed. */
export function voiceCount(song: Song): number {
  return isLocalSong(song) ? song.voiceCount : song.voices.length;
}
