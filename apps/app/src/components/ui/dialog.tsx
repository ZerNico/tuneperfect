import { Dialog as BaseDialog } from "base-ui-solid/dialog";
import type { Element } from "solid-js";
import IconX from "~icons/ph/x-bold";

interface DialogProps {
  onClose: () => void;
  title: string;
  children: Element;
  class?: string;
}

function DialogRoot(props: DialogProps) {
  return (
    <BaseDialog.Root open onOpenChange={(open) => !open && props.onClose()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop class="fixed inset-0 z-15 min-h-dvh bg-black/35 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute" />
        <BaseDialog.Viewport class="fixed inset-0 z-16 flex items-center justify-center">
          <BaseDialog.Popup class="m-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-auto rounded-[20px] surface-raised text-white transition-[scale,opacity] duration-150 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <div class="flex flex-col gap-4 p-6">
              <div class="flex items-center justify-between">
                <BaseDialog.Title class="text-xl font-bold">{props.title}</BaseDialog.Title>
                <BaseDialog.Close class="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                  <IconX />
                </BaseDialog.Close>
              </div>
              <div>{props.children}</div>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

interface DialogDescriptionProps {
  children: Element;
  class?: string;
}

function DialogDescription(props: DialogDescriptionProps) {
  return (
    <BaseDialog.Description class={["text-sm text-white/60", props.class]}>{props.children}</BaseDialog.Description>
  );
}

const Dialog = Object.assign(DialogRoot, {
  Description: DialogDescription,
});

export default Dialog;
