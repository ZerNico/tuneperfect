import { getVersion } from "@tauri-apps/api/app";
import { createResource, Show } from "solid-js";

import KeyHints from "./key-hints";

export default function SettingsFooter() {
  const [version] = createResource(() => getVersion());

  return (
    <div class="flex items-center justify-between">
      <KeyHints hints={["back", "navigate", "confirm"]} />
      <Show when={version()}>
        <span class="text-sm text-white/40 tabular-nums">v{version()}</span>
      </Show>
    </div>
  );
}
