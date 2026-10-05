import { Toast as KToast } from "@kobalte/core/toast";
import { createMemo } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import CircleCheck from "~icons/ph/check-circle-fill";
import Info from "~icons/ph/info-fill";
import CircleAlert from "~icons/ph/warning-circle-fill";
import X from "~icons/ph/x-bold";
import CircleX from "~icons/ph/x-circle-fill";

import { t } from "~/lib/i18n";

const TOAST_ICONS = new Map([
  ["success", CircleCheck],
  ["error", CircleX],
  ["info", Info],
  ["warning", CircleAlert],
]);

// Full class names (not built at runtime) so Tailwind picks them up.
const TOAST_COLORS = {
  success: { tint: "var(--color-green-400)", icon: "text-green-400" },
  error: { tint: "var(--color-red-400)", icon: "text-red-400" },
  info: { tint: "var(--color-sky-400)", icon: "text-sky-400" },
  warning: { tint: "var(--color-yellow-400)", icon: "text-yellow-400" },
} as const;

interface ToastProps {
  toastId: number;
  intent: "success" | "error" | "info" | "warning";
  message: string;
}

/** Same look as the game's notifications: dark card, intent icon with a soft wash of its colour. */
export default function Toast(props: ToastProps) {
  const IconComponent = createMemo(() => TOAST_ICONS.get(props.intent));
  const colors = () => TOAST_COLORS[props.intent];
  const title = () => t(`toast.${props.intent}`);

  return (
    // The Kobalte element owns the enter/exit/swipe transforms; the card sits inside it.
    <KToast
      toastId={props.toastId}
      class="pointer-events-auto w-full data-[closed]:animate-hide data-[opened]:animate-slide-in data-[swipe=end]:animate-swipe-out data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)]"
    >
      <div
        class="flex items-start gap-3 rounded-[16px] bg-black/75 p-3 pl-4 text-white ring-1 shadow-crisp ring-white/10 backdrop-blur-md ring-inset"
        style={{
          "background-image": `radial-gradient(circle at 24px 24px, color-mix(in oklch, ${colors().tint} 28%, transparent), transparent 140px)`,
        }}
      >
        <div class={`shrink-0 pt-0.5 text-2xl ${colors().icon}`}>
          <Dynamic component={IconComponent()} />
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <KToast.Title class="font-bold">{title()}</KToast.Title>
          <KToast.Description class="text-sm text-white/85">{props.message}</KToast.Description>
        </div>
        <KToast.CloseButton
          aria-label={t("common.close")}
          class="shrink-0 cursor-pointer p-1 text-white/60 transition-colors hover:text-white"
        >
          <X />
        </KToast.CloseButton>
      </div>
    </KToast>
  );
}

export function ToastRegion() {
  return (
    <Portal>
      <KToast.Region swipeDirection="right" limit={5}>
        {/* Top of the screen, clear of the header's content; full width on phones, a column on desktop. */}
        <KToast.List class="pointer-events-none fixed top-0 right-0 z-20 flex w-full max-w-sm flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" />
      </KToast.Region>
    </Portal>
  );
}
