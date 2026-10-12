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

/**
 * Receives the pitch stream until the returned function is called. Frames only come while a
 * recording runs, and the subscription carries over when it restarts.
 */
export function subscribePitchStream(onBatch: (batch: PitchBatch, receivedAt: number) => void): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const stream = await native.pitch.stream(undefined, { signal: controller.signal });
      for await (const batch of stream) onBatch(decodePitchBatch(batch), performance.now());
    } catch (error) {
      if (!controller.signal.aborted) console.warn("Pitch stream ended:", error);
    }
  })();

  return () => controller.abort();
}
