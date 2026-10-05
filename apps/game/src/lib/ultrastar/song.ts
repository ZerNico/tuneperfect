export type { LocalSong, UsdbSong } from "~/lib/native/types.gen";

import type { LocalSong, UsdbSong } from "~/lib/native/types.gen";

export type Song = LocalSong | UsdbSong;

export function isUsdbSong(song: Song): song is UsdbSong {
  return "songId" in song && "audioYoutubeId" in song;
}

export function isLocalSong(song: Song): song is LocalSong {
  return "audioUrl" in song;
}

/** How many voices a song has (2+ is a duet). Scanned songs don't carry their voices until loaded. */
export function voiceCount(song: Song): number {
  return isLocalSong(song) ? song.voiceCount : song.voices.length;
}
