import type { Song } from "./song";

export function msToBeat(song: Song, ms: number) {
  return msToBeatWithoutGap(song, ms - song.gap);
}

export function msToBeatWithoutGap(song: Song, ms: number) {
  const bpm = getBpm(song);
  return (bpm * ms) / 1000.0 / 60.0;
}

export function beatToMs(song: Song, beat: number) {
  return beatToMsWithoutGap(song, beat) + song.gap;
}

export function beatToMsWithoutGap(song: Song, beat: number) {
  const bpm = getBpm(song);
  return (beat * 1000.0 * 60.0) / bpm;
}

function getBpm(song: Song) {
  // Multiply by 4 because UltraStar songs use bars per minute instead of beats per minute
  return song.bpm * 4;
}
