import { Toast as KToast } from "@kobalte/core/toast";
import { createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
import CircleCheck from "~icons/ph/check-circle-fill";
import Info from "~icons/ph/info-fill";
import CircleAlert from "~icons/ph/warning-circle-fill";
import X from "~icons/ph/x-bold";
import CircleX from "~icons/ph/x-circle-fill";

import { t } from "~/lib/i18n";

import SlantPanel from "./slant-panel";

const TOAST_ICONS = new Map([
  ["success", CircleCheck],
  ["error", CircleX],
  ["info", Info],
  ["warning", CircleAlert],
]);

// Full class names (not built at runtime) so Tailwind picks them up.
const TOAST_COLORS = {
  success: { stripe: "bg-green-400", icon: "text-green-400" },
  error: { stripe: "bg-red-400", icon: "text-red-400" },
  info: { stripe: "bg-sky-400", icon: "text-sky-400" },
  warning: { stripe: "bg-yellow-400", icon: "text-yellow-400" },
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
    // The Kobalte element owns the enter/exit/swipe transforms; the slanted panel sits inside it.
    <KToast
      toastId={props.toastId}
      class="pointer-events-auto w-[26cqw] data-[closed]:animate-hide data-[opened]:animate-slide-in data-[swipe=end]:animate-swipe-out data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)]"
    >
      <SlantPanel
        class="flex items-start gap-3 py-3 pr-3 pl-5 text-white"
        surface="overflow-hidden rounded-xl bg-black/75 shadow-[0.35cqw_0.35cqw_0_rgb(0_0_0/0.35)] ring-1 ring-white/10 backdrop-blur-md ring-inset"
        surfaceContent={<span class={`absolute inset-y-0 left-0 w-[0.45cqw] ${colors().stripe}`} />}
      >
        <div class={`shrink-0 pt-0.5 text-2xl ${colors().icon}`}>
          <Dynamic component={IconComponent()} />
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <KToast.Title class="text-lg font-black tracking-wide uppercase italic">{title()}</KToast.Title>
          <KToast.Description class="text-base text-white/85">{props.message}</KToast.Description>
        </div>
        <KToast.CloseButton class="shrink-0 cursor-pointer p-1 text-white/60 transition-colors hover:text-white">
          <X />
        </KToast.CloseButton>
      </SlantPanel>
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
