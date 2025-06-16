import type { LocalSong } from "./song";

export function msToBeat(song: LocalSong, ms: number) {
  return msToBeatWithoutGap(song, ms - song.gap);
}

export function msToBeatWithoutGap(song: LocalSong, ms: number) {
  const bpm = getBpm(song);
  return (bpm * ms) / 1000.0 / 60.0;
}

export function beatToMs(song: LocalSong, beat: number) {
  return beatToMsWithoutGap(song, beat) + song.gap;
}

export function beatToMsWithoutGap(song: LocalSong, beat: number) {
  const bpm = getBpm(song);
  return (beat * 1000.0 * 60.0) / bpm;
}

function getBpm(song: LocalSong) {
  // Multiply by 4 because UltraStar songs use bars per minute instead of beats per minute
  return song.bpm * 4;
}
