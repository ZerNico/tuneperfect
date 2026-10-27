export interface PitchSample {
  time: number;
  /** Hz, or -1 without a pitch. */
  hz: number;
  level: number;
}

/**
 * The last few seconds of one microphone's pitch, in time order: a ring of plain numbers, so
 * reading it every frame allocates nothing and triggers no reactivity.
 */
export class PitchTimeline {
  private readonly times: Float64Array;
  private readonly hzs: Float32Array;
  private readonly levels: Float32Array;
  /** Index of the oldest sample. */
  private start = 0;
  private count = 0;

  /** 1024 samples hold about 10 s at 100 frames a second. */
  constructor(private readonly capacity = 1024) {
    this.times = new Float64Array(capacity);
    this.hzs = new Float32Array(capacity);
    this.levels = new Float32Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  /** Adds a sample. One older than the newest is dropped, so the timeline stays in order. */
  push(time: number, hz: number, level: number) {
    if (this.count > 0 && time < this.times[this.slot(this.count - 1)]!) return;

    const slot = this.slot(this.count);
    this.times[slot] = time;
    this.hzs[slot] = hz;
    this.levels[slot] = level;
    if (this.count < this.capacity) this.count++;
    else this.start = (this.start + 1) % this.capacity;
  }

  clear() {
    this.start = 0;
    this.count = 0;
  }

  latest(): PitchSample | undefined {
    return this.count === 0 ? undefined : this.at(this.count - 1);
  }

  /** Calls `visit` for every sample with `from <= time <= to`, oldest first. */
  forEachInRange(from: number, to: number, visit: (time: number, hz: number, level: number) => void) {
    for (let i = this.firstAtOrAfter(from); i < this.count; i++) {
      const slot = this.slot(i);
      const time = this.times[slot]!;
      if (time > to) break;
      visit(time, this.hzs[slot]!, this.levels[slot]!);
    }
  }

  private at(i: number): PitchSample {
    const slot = this.slot(i);
    return { time: this.times[slot]!, hz: this.hzs[slot]!, level: this.levels[slot]! };
  }

  private slot(i: number): number {
    return (this.start + i) % this.capacity;
  }

  /** Binary search for the first sample at or after `time`. */
  private firstAtOrAfter(time: number): number {
    let low = 0;
    let high = this.count;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.times[this.slot(mid)]! < time) low = mid + 1;
      else high = mid;
    }
    return low;
  }
}
