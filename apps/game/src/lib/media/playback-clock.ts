/** Without a new sample for this long, the source has likely stopped answering: stop extrapolating. */
const MAX_INTERPOLATION_MS = 1000;
/**
 * A sample this far behind the position already handed out is jitter, not a seek: hold the
 * clock until the source catches up instead of stepping back, which the lyrics would show.
 */
const MAX_HOLD_S = 0.3;

/**
 * The position of a player that only reports it now and then (the YouTube embed, about 4 times
 * a second), interpolated in between so the game can read it every frame.
 *
 * It only runs while the source is actually advancing. After `play()` a video still buffers for
 * a moment; a clock that ran on through that would jump back when the first real sample arrived.
 */
export class PlaybackClock {
  private time = 0;
  /** When `time` was sampled. Samples are posted when the source's clock advanced, so this is a good anchor. */
  private sampledAt = 0;
  private running = false;
  /** The last position handed out, so jitter never moves the clock backwards. */
  private reported = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** A position the source just reported. */
  sample(time: number) {
    this.time = time;
    this.sampledAt = this.now();
  }

  /** Whether the source is advancing right now. Stopping freezes the clock where it got to. */
  setRunning(running: boolean) {
    if (running === this.running) return;
    if (!running) this.time = this.position();
    this.sampledAt = this.now();
    this.running = running;
  }

  /** Jumps to `time`, backwards too. */
  seek(time: number) {
    this.time = time;
    this.sampledAt = this.now();
    this.reported = time;
  }

  /** The current position in seconds. */
  position(): number {
    let time = this.time;
    if (this.running) time += Math.min(this.now() - this.sampledAt, MAX_INTERPOLATION_MS) / 1000;
    if (time < this.reported && this.reported - time < MAX_HOLD_S) return this.reported;
    this.reported = time;
    return time;
  }
}
