import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";

import { keyMode } from "~/hooks/navigation";

interface KeyGlyphProps {
  keyboard: Component<{ class?: string }>;
  gamepad: Component<{ class?: string }>;
  class?: string;
}

/** The key or gamepad button for an action, matching the current input device. */
export default function KeyGlyph(props: KeyGlyphProps) {
  return <Dynamic component={keyMode() === "gamepad" ? props.gamepad : props.keyboard} class={props.class} />;
}
