import { native } from "~/lib/native/client";

export interface PitchFrame {
  mic: number;
  /** When the frame's last sample was captured, on the audio clock (ms). */
  time: number;
  /** Hz, or -1 without a pitch. */
  hz: number;
  /** Peak amplitude, after gain. */
  level: number;
}

export interface PitchBatch {
  /** When the batch was sent, on the audio clock (ms). */
  sentAt: number;
  frames: PitchFrame[];
}

/** Reads a batch of the `pitch.stream` layout (see `src/lib/native/contract.ts`). */
export function decodePitchBatch(batch: Float64Array): PitchBatch {
  const count = batch[1] ?? 0;
  const frames: PitchFrame[] = [];
  for (let i = 0; i < count; i++) {
    const at = 2 + i * 4;
    frames.push({ mic: batch[at]!, time: batch[at + 1]!, hz: batch[at + 2]!, level: batch[at + 3]! });
  }
  return { sentAt: batch[0] ?? 0, frames };
}

/** How long to wait before subscribing again after the stream broke off, growing up to the max. */
const RETRY_MS = 100;
const MAX_RETRY_MS = 2000;

/**
 * Receives the pitch stream until the returned function is called. Frames only come while a
 * recording runs, and the subscription carries over when it restarts. If the stream breaks off,
 * it's subscribed again: without it every beat would score as silence.
 */
export function subscribePitchStream(onBatch: (batch: PitchBatch, receivedAt: number) => void): () => void {
  const controller = new AbortController();
  const { signal } = controller;

  void (async () => {
    let retryMs = RETRY_MS;
    while (!signal.aborted) {
      try {
        const stream = await native.pitch.stream(undefined, { signal });
        for await (const batch of stream) {
          onBatch(decodePitchBatch(batch), performance.now());
          retryMs = RETRY_MS;
        }
      } catch (error) {
        if (signal.aborted) return;
        console.warn("Pitch stream broke off, subscribing again:", error);
      }
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  })();

  return () => controller.abort();
}
