import { dynamic } from "@solidjs/web";
import { Toast as BaseToast } from "base-ui-solid/toast";
import { For } from "solid-js";
import CircleCheck from "~icons/ph/check-circle-fill";
import Info from "~icons/ph/info-fill";
import CircleAlert from "~icons/ph/warning-circle-fill";
import X from "~icons/ph/x-bold";
import CircleX from "~icons/ph/x-circle-fill";

import { t } from "~/lib/i18n";
import { type ToastIntent, toastManager } from "~/lib/toast";

const TOAST_ICONS = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: CircleAlert,
} as const;

// Full class names (not built at runtime) so Tailwind picks them up.
const TOAST_COLORS = {
  success: { tint: "var(--color-green-400)", icon: "text-green-400" },
  error: { tint: "var(--color-red-400)", icon: "text-red-400" },
  info: { tint: "var(--color-sky-400)", icon: "text-sky-400" },
  warning: { tint: "var(--color-yellow-400)", icon: "text-yellow-400" },
} as const;

type ToastObject = Parameters<typeof BaseToast.Root>[0]["toast"];

/** Same look as the game's notifications: dark card, intent icon with a soft wash of its colour. */
function Toast(props: { toast: ToastObject }) {
  const intent = () => (props.toast.type ?? "info") as ToastIntent;
  const Icon = dynamic(() => TOAST_ICONS[intent()]);

  return (
    // The root owns the enter/exit/swipe transforms; the card sits inside it.
    <BaseToast.Root
      toast={props.toast}
      swipeDirection="right"
      class="pointer-events-auto w-full translate-x-(--toast-swipe-movement-x) transition-[translate,opacity] duration-150 ease-out data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-x-full data-swiping:duration-0 data-ending-style:data-[swipe-direction=right]:translate-x-full"
    >
      <div
        class="flex items-start gap-3 rounded-[16px] bg-black/75 p-3 pl-4 text-white ring-1 ring-white/10 backdrop-blur-md ring-inset"
        style={{
          "background-image": `radial-gradient(circle at 24px 24px, color-mix(in oklch, ${TOAST_COLORS[intent()].tint} 28%, transparent), transparent 140px)`,
        }}
      >
        <div class={["shrink-0 pt-0.5 text-2xl", TOAST_COLORS[intent()].icon]}>
          <Icon />
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <BaseToast.Title class="font-bold">{t(`toast.${intent()}`)}</BaseToast.Title>
          <BaseToast.Description class="text-sm text-white/85" />
        </div>
        <BaseToast.Close
          aria-label={t("common.close")}
          class="shrink-0 cursor-pointer p-1 text-white/60 transition-colors hover:text-white"
        >
          <X />
        </BaseToast.Close>
      </div>
    </BaseToast.Root>
  );
}

function ToastList() {
  const manager = BaseToast.useToastManager();
  return (
    <For each={manager.toasts} keyed={(toast) => toast.id}>
      {(toast) => <Toast toast={toast()} />}
    </For>
  );
}

export function ToastRegion() {
  return (
    <BaseToast.Provider toastManager={toastManager} limit={5}>
      <BaseToast.Portal>
        {/* Top of the screen, clear of the header's content; full width on phones, a column on desktop. */}
        <BaseToast.Viewport class="pointer-events-none fixed top-0 right-0 z-20 flex w-full max-w-sm flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
