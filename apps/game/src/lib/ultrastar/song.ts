export type { LocalSong, UsdbSong } from "~/bindings";

import type { LocalSong, UsdbSong } from "~/bindings";

export type Song = LocalSong | UsdbSong;

export function isUsdbSong(song: Song): song is UsdbSong {
  return "songId" in song && "audioYoutubeId" in song;
}

export function isLocalSong(song: Song): song is LocalSong {
  return "audioUrl" in song;
}
