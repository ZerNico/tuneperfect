/** Without a new sample for this long, the source has likely stopped answering: stop extrapolating. */
const MAX_INTERPOLATION_MS = 1000;
/** Further off than this, the clock jumps to the sample (a seek, a stall): drifting there would take too long. */
const SNAP_S = 0.3;
/** Smaller differences are worked off over about this long… */
const CORRECTION_S = 0.5;
/** …running at most this much faster or slower than real time, which nobody notices. */
const MAX_RATE_CHANGE = 0.25;

/**
 * The position of a player that only reports it now and then (the YouTube embed, about 4 times
 * a second, unevenly at first), smoothed for reading every frame: it never steps back or stalls
 * on small differences, but runs slightly faster or slower until it's back in line.
 *
 * It only runs while the source is actually advancing. After `play()` a video still buffers for
 * a moment; a clock that ran on through that would have to jump back when playback began.
 */
export class PlaybackClock {
  /** The position at `baseAt`, from where it runs on at `rate`. */
  private base = 0;
  private baseAt = 0;
  private rate = 1;
  private running = false;
  /** When the source last reported, to stop extrapolating when it goes quiet. */
  private sampledAt = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** A position the source just reported. Samples are posted when its clock advanced, so they're current. */
  sample(time: number) {
    const now = this.now();
    this.sampledAt = now;

    const error = time - this.position();
    if (!this.running || Math.abs(error) > SNAP_S) {
      this.rebase(time, 1);
      return;
    }

    const change = Math.max(-MAX_RATE_CHANGE, Math.min(MAX_RATE_CHANGE, error / CORRECTION_S));
    this.rebase(this.position(), 1 + change);
  }

  /** Whether the source is advancing right now. Stopping freezes the clock where it got to. */
  setRunning(running: boolean) {
    if (running === this.running) return;
    this.rebase(this.position(), 1);
    this.running = running;
    if (running) this.sampledAt = this.now();
  }

  /** Jumps to `time`, backwards too. */
  seek(time: number) {
    this.rebase(time, 1);
  }

  /** The current position in seconds. */
  position(): number {
    if (!this.running) return this.base;
    const until = Math.min(this.now(), this.sampledAt + MAX_INTERPOLATION_MS);
    return this.base + (Math.max(0, until - this.baseAt) * this.rate) / 1000;
  }

  private rebase(position: number, rate: number) {
    this.base = position;
    this.baseAt = this.now();
    this.rate = rate;
  }
}
