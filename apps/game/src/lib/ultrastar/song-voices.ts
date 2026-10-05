import { unpackVoices } from "./packed-notes";
import type { LocalSong } from "./song";

/**
 * The song with its voices. The scanned library carries every song's notes packed (as objects
 * they'd be a gigabyte for a big library), so they're unpacked for a song that's played or
 * previewed, which takes well under a millisecond.
 */
export function withVoices(song: LocalSong): LocalSong {
  if (song.voices.length > 0 || song.voiceCount === 0) {
    return song;
  }
  return { ...song, voices: unpackVoices(song.notes) };
}
