import { access, type MaybeAccessor } from "@solid-primitives/utils";
import { createComputed, createSignal, on } from "solid-js";

/** A position in `[0, max)` that wraps around at both ends. Stays 0 while `max` is 0. */
export function createLoop(max: MaybeAccessor<number>) {
  const [position, setPosition] = createSignal(0);

  const clamp = (value: number) => Math.max(0, Math.min(value, access(max) - 1));

  // Keep the position on the list when it shrinks.
  createComputed(
    on(
      () => access(max),
      () => setPosition(clamp),
    ),
  );

  const wrap = (value: number) => {
    const count = access(max);
    return count > 0 ? ((value % count) + count) % count : 0;
  };

  const increment = () => setPosition((prev) => wrap(prev + 1));
  const decrement = () => setPosition((prev) => wrap(prev - 1));
  const set = (value: number) => setPosition(clamp(value));

  return { position, increment, decrement, set };
}
