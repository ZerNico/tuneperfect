import { Dialog as KDialog } from "@kobalte/core/dialog";
import { Link, useLocation } from "@tanstack/solid-router";
import { createEffect, createSignal, on, Show } from "solid-js";
import IconX from "~icons/ph/x-bold";

import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

import RemotePanel from "./remote-panel";

/**
 * Brings up your controls from anywhere in the lobby when it becomes your move in the game (e.g.
 * your duel in versus), and vibrates. On the controller itself there's no need.
 */
export default function RemoteSheet() {
  const remote = useRemote();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);

  const attention = () => remote.state()?.attention ?? false;
  const panel = () => remote.state()?.panel ?? null;

  createEffect(
    on(attention, (attention, previous) => {
      if (!attention) {
        setOpen(false);
        return;
      }
      if (previous || location().pathname === "/controller") return;
      setOpen(true);
      navigator.vibrate?.([40, 60, 40]);
    }),
  );
  // Went to the controller: the same controls are right there.
  createEffect(() => {
    if (location().pathname === "/controller") setOpen(false);
  });

  return (
    <KDialog open={open() && !!panel()} onOpenChange={setOpen}>
      <KDialog.Portal>
        <KDialog.Overlay class="fixed inset-0 z-15 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-x-0 bottom-0 z-16 flex justify-center">
          <KDialog.Content class="max-h-[85dvh] w-full max-w-md overflow-auto rounded-t-[24px] surface-raised px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white outline-none">
            <div class="mb-4 flex items-center justify-between">
              <KDialog.Title class="text-xl font-bold">{t("remote.yourMove")}</KDialog.Title>
              <KDialog.CloseButton
                aria-label={t("remote.close")}
                class="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconX />
              </KDialog.CloseButton>
            </div>
            <Show when={panel()}>{(panel) => <RemotePanel panel={panel()} />}</Show>
            <Link
              to="/controller"
              class="mt-3 flex h-12 items-center justify-center rounded-[12px] font-bold text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              {t("remote.open")}
            </Link>
          </KDialog.Content>
        </div>
      </KDialog.Portal>
    </KDialog>
  );
}
