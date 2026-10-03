import { Dialog as KDialog } from "@kobalte/core/dialog";
import type { JSX } from "solid-js";
import IconX from "~icons/ph/x-bold";

interface DialogProps {
  onClose: () => void;
  title: string;
  children: JSX.Element;
  class?: string;
}

function DialogRoot(props: DialogProps) {
  return (
    <KDialog open onOpenChange={(open) => !open && props.onClose()}>
      <KDialog.Portal>
        <KDialog.Overlay class="fixed inset-0 z-15 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-16 flex items-center justify-center">
          <KDialog.Content class="m-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-auto rounded-[20px] surface-raised text-white">
            <div class="flex flex-col gap-4 p-6">
              <div class="flex items-center justify-between">
                <KDialog.Title class="text-xl font-bold">{props.title}</KDialog.Title>
                <KDialog.CloseButton class="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                  <IconX />
                </KDialog.CloseButton>
              </div>
              <div>{props.children}</div>
            </div>
          </KDialog.Content>
        </div>
      </KDialog.Portal>
    </KDialog>
  );
}

interface DialogDescriptionProps {
  children: JSX.Element;
  class?: string;
}

function DialogDescription(props: DialogDescriptionProps) {
  return (
    <KDialog.Description class="text-sm text-white/60" classList={{ [props.class || ""]: true }}>
      {props.children}
    </KDialog.Description>
  );
}

const Dialog = Object.assign(DialogRoot, {
  Description: DialogDescription,
});

export default Dialog;
