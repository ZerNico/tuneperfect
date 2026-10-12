/** A song-time jump bigger than this between frames is a seek, not jitter. */
const SEEK_MS = 250;

/**
 * Maps `performance.now()` times to song time, from the game loop's frames, so pitch frames
 * (captured at a known `performance.now()` time) land where they were sung.
 *
 * The mapping only holds while the song plays continuously: a seek or a pause starts a new
 * `epoch`, and times from before it map to nothing, so stale frames are dropped instead of being
 * drawn in the wrong place.
 */
export class SongClock {
  private perf = 0;
  private song = 0;
  private playing = false;
  private epochStart = Number.POSITIVE_INFINITY;
  /** Increases on every seek and resume. */
  epoch = 0;

  /** The game loop's latest frame: song time `songMs` at `perfMs`. */
  frame(perfMs: number, songMs: number, playing: boolean) {
    const expected = this.song + (perfMs - this.perf);
    const resumed = playing && !this.playing;
    const seeked = playing && this.playing && Math.abs(songMs - expected) > SEEK_MS;
    if (resumed || seeked) {
      this.epoch++;
      this.epochStart = perfMs;
    }

    this.perf = perfMs;
    this.song = songMs;
    this.playing = playing;
  }

  /** Song time at `perfMs`, or `undefined` before the current epoch or while not playing. */
  songAt(perfMs: number): number | undefined {
    if (!this.playing || perfMs < this.epochStart) return undefined;
    return this.song + (perfMs - this.perf);
  }
}
