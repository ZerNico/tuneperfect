/** How long a fast delivery keeps counting as the reference. */
const WINDOW_MS = 5000;

/**
 * Maps times on the audio clock (the native side's) to `performance.now()`.
 *
 * A batch of pitch frames reaches the renderer through the main process, and either side can be
 * busy for a frame or two, so some batches arrive 10 to 30 ms late. Taking the fastest delivery
 * of the last few seconds as the clocks' offset ignores those delays: a late batch's frames still
 * land where they were sung. What's left is the fastest delivery's own latency, a few
 * milliseconds and steady, which the microphone delay setting absorbs.
 */
export class DeliveryClock {
  private deliveries: { receivedAt: number; offset: number }[] = [];
  private offset: number | undefined;

  /** A batch sent at `sentAt` (audio clock) arrived at `receivedAt` (`performance.now()`). */
  observe(sentAt: number, receivedAt: number) {
    const offset = receivedAt - sentAt;
    this.deliveries.push({ receivedAt, offset });
    while (this.deliveries.length > 1 && this.deliveries[0]!.receivedAt < receivedAt - WINDOW_MS) {
      this.deliveries.shift();
    }
    this.offset = Math.min(...this.deliveries.map((delivery) => delivery.offset));
  }

  /** `audioTime` as `performance.now()` time, once a batch has arrived. */
  toLocal(audioTime: number): number | undefined {
    return this.offset === undefined ? undefined : audioTime + this.offset;
  }

  reset() {
    this.deliveries = [];
    this.offset = undefined;
  }
}
