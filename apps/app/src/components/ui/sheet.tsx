import { Dialog as KDialog } from "@kobalte/core/dialog";
import type { JSX } from "solid-js";
import IconX from "~icons/ph/x-bold";

import { t } from "~/lib/i18n";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: JSX.Element;
}

/**
 * A panel sliding up from the bottom on phones (in reach of the thumb), a centred dialog on wider
 * screens. Its content scrolls when it's taller than the screen; the title stays.
 */
export default function Sheet(props: SheetProps) {
  return (
    <KDialog open={props.open} onOpenChange={(open) => props.onOpenChange(open)}>
      <KDialog.Portal>
        <KDialog.Overlay class="fixed inset-0 z-15 bg-black/35" />
        <div class="fixed inset-x-0 bottom-0 z-16 flex justify-center sm:inset-0 sm:items-center sm:p-6">
          <KDialog.Content class="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[24px] surface-raised text-white outline-none sm:rounded-[20px]">
            <div class="flex shrink-0 items-center justify-between px-6 pt-4 pb-2 sm:pt-5">
              <KDialog.Title class="text-xl font-bold">{props.title}</KDialog.Title>
              <KDialog.CloseButton
                aria-label={t("remote.close")}
                class="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconX />
              </KDialog.CloseButton>
            </div>
            <div class="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
              {props.children}
            </div>
          </KDialog.Content>
        </div>
      </KDialog.Portal>
    </KDialog>
  );
}
