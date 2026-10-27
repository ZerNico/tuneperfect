/** A song-time jump bigger than this between frames is a seek, not jitter. */
const SEEK_MS = 250;

/**
 * Maps `performance.now()` times to song time, from the game loop's frames, so pitch frames
 * (captured at a known `performance.now()` time) land where they were sung.
 *
 * The mapping holds from when the song (re)started playing until it was paused, so frames sung
 * just before a pause still land once they arrive. A seek starts a new `epoch`, and times from
 * before it map to nothing, so stale frames are dropped instead of being drawn in the wrong place.
 */
export class SongClock {
  private perf = 0;
  private song = 0;
  private playing = false;
  /** The span of `performance.now()` times the mapping holds for. */
  private from = Number.POSITIVE_INFINITY;
  private until = Number.POSITIVE_INFINITY;
  /** Increases on every seek, and when playback first starts. */
  epoch = 0;

  /** The game loop's latest frame: song time `songMs` at `perfMs`. */
  frame(perfMs: number, songMs: number, playing: boolean) {
    if (!playing) {
      if (this.playing) this.until = perfMs;
      this.playing = false;
      return;
    }

    if (!this.playing) {
      // Starting, or resuming: the song picks up where it paused unless it was moved meanwhile.
      if (this.from === Number.POSITIVE_INFINITY || Math.abs(songMs - this.song) > SEEK_MS) this.epoch++;
      this.from = perfMs;
      this.until = Number.POSITIVE_INFINITY;
    } else if (songMs === this.song) {
      // A song time that didn't move (a stalled frame, or the song has ended) says nothing new:
      // the song keeps running at real time from the last one that did.
      return;
    } else if (Math.abs(songMs - (this.song + (perfMs - this.perf))) > SEEK_MS) {
      this.epoch++;
      this.from = perfMs;
    }

    this.perf = perfMs;
    this.song = songMs;
    this.playing = true;
  }

  /** Song time at `perfMs`, or `undefined` outside the span the song played continuously. */
  songAt(perfMs: number): number | undefined {
    if (perfMs < this.from || perfMs > this.until) return undefined;
    return this.song + (perfMs - this.perf);
  }
}
