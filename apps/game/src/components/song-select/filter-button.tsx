import { Show } from "solid-js";
import IconFilter from "~icons/lucide/sliders-horizontal";
import IconF4Key from "~icons/sing/f4-key";
import IconGamepadY from "~icons/sing/gamepad-y";

import { keyMode } from "~/hooks/navigation";
import { t } from "~/lib/i18n";

interface FilterButtonProps {
  onClick: () => void;
}

export function FilterButton(props: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-label={t("sing.filter.title")}
      class="flex items-center gap-6 rounded-full border-[0.12cqw] border-white px-1 py-0.5 text-sm text-white transition-all hover:opacity-75 active:scale-95"
      onClick={() => props.onClick()}
    >
      <div class="flex items-center gap-1">
        <IconFilter class="shrink-0" />
        <span class="truncate font-medium">{t("sing.filter.title")}</span>
      </div>
      <Show when={keyMode() === "keyboard"} fallback={<IconGamepadY class="shrink-0 text-xs" />}>
        <IconF4Key class="shrink-0 text-xs" />
      </Show>
    </button>
  );
}
