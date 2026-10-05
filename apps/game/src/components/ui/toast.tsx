import { Toast as KToast } from "@kobalte/core/toast";
import { createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
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

export default function Toast(props: ToastProps) {
  const IconComponent = createMemo(() => TOAST_ICONS.get(props.intent));
  const colors = () => TOAST_COLORS[props.intent];
  const title = () => t(`common.notifications.${props.intent}`);

  return (
    // The Kobalte element owns the enter/exit/swipe transforms; the card sits inside it.
    <KToast
      toastId={props.toastId}
      class="pointer-events-auto w-[26cqw] data-[closed]:animate-hide data-[opened]:animate-slide-in data-[swipe=end]:animate-swipe-out data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)]"
    >
      <div
        class="flex items-start gap-3 rounded-[1cqw] bg-black/75 p-3 pl-4 text-white shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)] ring-1 ring-white/10 backdrop-blur-md ring-inset"
        style={{
          // A soft wash of the intent colour behind the icon.
          "background-image": `radial-gradient(circle at 1.4cqw 1.4cqw, color-mix(in oklch, ${colors().tint} 28%, transparent), transparent 9cqw)`,
        }}
      >
        <div class={`shrink-0 pt-0.5 text-2xl ${colors().icon}`}>
          <Dynamic component={IconComponent()} />
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <KToast.Title class="text-lg font-bold">{title()}</KToast.Title>
          <KToast.Description class="text-base text-white/85">{props.message}</KToast.Description>
        </div>
        <KToast.CloseButton class="shrink-0 cursor-pointer p-1 text-white/60 transition-colors hover:text-white">
          <X />
        </KToast.CloseButton>
      </div>
    </KToast>
  );
}

export function ToastRegion() {
  return (
    <KToast.Region swipeDirection="right" limit={5}>
      <KToast.List class="pointer-events-none absolute inset-0 z-10 flex flex-col items-end justify-start gap-2 p-4" />
    </KToast.Region>
  );
}
