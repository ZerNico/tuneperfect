import { Toast as KToast } from "@kobalte/core/toast";
import { createMemo } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { t } from "~/lib/i18n";
import CircleAlert from "~icons/lucide/circle-alert";
import CircleCheck from "~icons/lucide/circle-check";
import CircleX from "~icons/lucide/circle-x";
import Info from "~icons/lucide/info";
import X from "~icons/lucide/x";

const TOAST_ICONS = new Map([
  ["success", CircleCheck],
  ["error", CircleX],
  ["info", Info],
  ["warning", CircleAlert],
]);

const TOAST_COLORS = new Map([
  ["success", "bg-green-400"],
  ["error", "bg-red-400"],
  ["info", "bg-blue-400"],
  ["warning", "bg-yellow-400"],
]);

interface ToastProps {
  toastId: number;
  intent: "success" | "error" | "info" | "warning";
  message: string;
}

export default function Toast(props: ToastProps) {
  const IconComponent = createMemo(() => TOAST_ICONS.get(props.intent));
  const bgColor = () => TOAST_COLORS.get(props.intent);
  const title = () => t(`toast.${props.intent}`);

  return (
    <KToast
      toastId={props.toastId}
      class="flex w-full transform items-start justify-between rounded-lg p-3 data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)] data-[closed]:animate-hide data-[opened]:animate-slide-in data-[swipe=end]:animate-swipe-out"
      classList={{
        [bgColor() || ""]: true,
      }}
    >
      <div class="flex">
        <div class={`mr-3 flex-shrink-0 text-xl text-toast-${props.intent}`}>
          <Dynamic component={IconComponent()} />
        </div>
        <div class="flex flex-col gap-1">
          <KToast.Title class="font-semibold">{title()}</KToast.Title>
          <KToast.Description>{props.message}</KToast.Description>
        </div>
      </div>
      <KToast.CloseButton class="cursor-pointer">
        <X />
      </KToast.CloseButton>
    </KToast>
  );
}

export function ToastRegion() {
  return (
    <Portal>
      <KToast.Region swipeDirection="right" limit={5}>
        <KToast.List class="fixed top-0 right-0 z-20 flex w-90 max-w-screen flex-col gap-2 p-8" />
      </KToast.Region>
    </Portal>
  );
}
