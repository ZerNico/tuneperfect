import { appVersion } from "~/lib/desktop";

import KeyHints from "./key-hints";

export default function SettingsFooter() {
  return (
    <div class="flex items-center justify-between">
      <KeyHints hints={["back", "navigate", "confirm"]} />
      <span class="text-sm text-white/40 tabular-nums">v{appVersion}</span>
    </div>
  );
}
