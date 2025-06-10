import { access, type MaybeAccessor } from "@solid-primitives/utils";
import { createSignal } from "solid-js";

export function createLoop(max: MaybeAccessor<number>) {
  const [position, setPosition] = createSignal(0);

  const increment = () => {
    setPosition((prev) => (prev + 1) % access(max));
  };

  const decrement = () => {
    setPosition((prev) => (prev - 1 + access(max)) % access(max));
  };

  const set = (value: number) => {
    setPosition(() => value);
  };

  return { position, increment, decrement, set };
}
