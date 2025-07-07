import { Dialog as KDialog } from "@kobalte/core/dialog";
import type { JSX } from "solid-js";
import IconX from "~icons/lucide/x";
import Card from "./card";

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
        <KDialog.Overlay class="fixed inset-0 z-15 bg-black/40 backdrop-blur-sm" />
        <div class="fixed inset-0 z-16 flex items-center justify-center">
          <KDialog.Content class="m-4 max-h-[calc(100vh-2rem)] max-w-md overflow-auto shadow-lg">
            <Card class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <KDialog.Title class="font-semibold text-lg">{props.title}</KDialog.Title>
                <KDialog.CloseButton class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/10">
                  <IconX class="" />
                </KDialog.CloseButton>
              </div>
              <div>{props.children}</div>
            </Card>
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
    <KDialog.Description class="text-slate-600 text-sm" classList={{ [props.class || ""]: true }}>
      {props.children}
    </KDialog.Description>
  );
}

const Dialog = Object.assign(DialogRoot, {
  Description: DialogDescription,
});

export default Dialog;
