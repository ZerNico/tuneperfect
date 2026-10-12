import type { JSX } from "@solidjs/web";
import { createContext, createSignal, Show, useContext } from "solid-js";

import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import { t } from "~/lib/i18n";

interface DialogOptions {
  title: string;
  /** Plain text: the dialog is usually opened from an event handler, where JSX would have no owner. */
  description: string;
  intent?: "delete" | "confirm";
  /** Label of the confirm button; "Confirm" by default. */
  confirmLabel?: string;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType>();

export function DialogProvider(props: { children: JSX.Element }) {
  const [dialogOptions, setDialogOptions] = createSignal<DialogOptions | null>(null);
  let resolvePromise: ((value: boolean) => void) | null = null;

  const showDialog = (options: DialogOptions): Promise<boolean> => {
    // A dialog opened over another one answers the first with "cancel", so nobody waits forever
    resolvePromise?.(false);
    return new Promise((resolve) => {
      setDialogOptions(options);
      resolvePromise = resolve;
    });
  };

  const handleClose = (confirmed: boolean) => {
    setDialogOptions(null);
    if (resolvePromise) {
      resolvePromise(confirmed);
      resolvePromise = null;
    }
  };

  return (
    <DialogContext value={{ showDialog }}>
      {props.children}
      <Show when={dialogOptions()}>
        {(dialogOptions) => (
          <Dialog onClose={() => handleClose(false)} title={dialogOptions()?.title ?? ""}>
            <Dialog.Description>{dialogOptions()?.description}</Dialog.Description>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => handleClose(false)}>{t("common.cancel")}</Button>
              <Button
                onClick={() => handleClose(true)}
                intent={dialogOptions()?.intent === "delete" ? "danger" : "gradient"}
              >
                {dialogOptions()?.confirmLabel ?? t("common.confirm")}
              </Button>
            </div>
          </Dialog>
        )}
      </Show>
    </DialogContext>
  );
}

/** Throws outside `DialogProvider`. */
export function useDialog() {
  return useContext(DialogContext);
}
