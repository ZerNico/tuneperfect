import { type Accessor, createRenderEffect, type Ref } from "solid-js";

export function createRefContent<T>(ref: Accessor<Ref<T> | undefined>, content: Accessor<T>) {
  createRenderEffect(() => {
    const refProp = ref();

    if (!refProp) {
      return;
    }

    if (typeof refProp !== "function") {
      throw new Error("Should never happen, as solid always passes refs as functions");
    }

    const refFunc = refProp as (val: T) => void;
    refFunc(content());
  });
}
