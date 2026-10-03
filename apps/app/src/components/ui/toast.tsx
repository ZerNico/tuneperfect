import { Toast as KToast } from "@kobalte/core/toast";
import { createMemo } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import CircleAlert from "~icons/lucide/circle-alert";
import CircleCheck from "~icons/lucide/circle-check";
import CircleX from "~icons/lucide/circle-x";
import Info from "~icons/lucide/info";
import X from "~icons/lucide/x";

import { t } from "~/lib/i18n";

const TOAST_ICONS = new Map([
  ["success", CircleCheck],
  ["error", CircleX],
  ["info", Info],
  ["warning", CircleAlert],
]);

const TOAST_COLORS = new Map([
  ["success", "text-green-400"],
  ["error", "text-red-400"],
  ["info", "text-sky-400"],
  ["warning", "text-yellow-400"],
]);

interface ToastProps {
  toastId: number;
  intent: "success" | "error" | "info" | "warning";
  message: string;
}

export default function Toast(props: ToastProps) {
  const IconComponent = createMemo(() => TOAST_ICONS.get(props.intent));
  const iconColor = () => TOAST_COLORS.get(props.intent);
  const title = () => t(`toast.${props.intent}`);

  return (
    <KToast
      toastId={props.toastId}
      class="flex w-full transform items-start justify-between gap-3 rounded-[14px] surface-raised p-3.5 text-white data-[closed]:animate-hide data-[opened]:animate-slide-in data-[swipe=end]:animate-swipe-out data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)]"
    >
      <div class="flex">
        <div class={`mr-3 shrink-0 text-xl ${iconColor() ?? ""}`}>
          <Dynamic component={IconComponent()} />
        </div>
        <div class="flex flex-col gap-1">
          <KToast.Title class="font-bold">{title()}</KToast.Title>
          <KToast.Description class="text-sm text-white/75">{props.message}</KToast.Description>
        </div>
      </div>
      <KToast.CloseButton class="cursor-pointer text-white/60 hover:text-white">
        <X />
      </KToast.CloseButton>
    </KToast>
  );
}

export function ToastRegion() {
  return (
    <Portal>
      <KToast.Region swipeDirection="right" limit={5}>
        <KToast.List class="fixed top-0 right-0 z-20 flex w-96 max-w-screen flex-col gap-2 p-4" />
      </KToast.Region>
    </Portal>
  );
}
