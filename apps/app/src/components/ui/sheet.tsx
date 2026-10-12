import { Drawer } from "base-ui-solid/drawer";
import type { Element } from "solid-js";
import IconX from "~icons/ph/x-bold";

import { t } from "~/lib/i18n";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: Element;
}

/**
 * A panel sliding up from the bottom on phones (in reach of the thumb, swipe down to close), a centred dialog on wider
 * screens. Its content scrolls when it's taller than the screen; the title stays.
 */
export default function Sheet(props: SheetProps) {
  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => props.onOpenChange(open)}>
      <Drawer.Portal>
        <Drawer.Backdrop class="fixed inset-0 z-15 min-h-dvh bg-black/35 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport class="fixed inset-0 z-16 flex items-end justify-center sm:items-center sm:p-6">
          <Drawer.Popup class="flex max-h-[85dvh] w-full max-w-md translate-y-(--drawer-swipe-movement-y) flex-col rounded-t-[24px] surface-raised text-white transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:duration-0 data-swiping:select-none sm:rounded-[20px] sm:data-ending-style:translate-y-4 sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-4 sm:data-starting-style:opacity-0">
            <div class="flex shrink-0 items-center justify-between px-6 pt-4 pb-2 sm:pt-5">
              <Drawer.Title class="text-xl font-bold">{props.title}</Drawer.Title>
              <Drawer.Close
                aria-label={t("remote.close")}
                class="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconX />
              </Drawer.Close>
            </div>
            <Drawer.Content class="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
              {props.children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
