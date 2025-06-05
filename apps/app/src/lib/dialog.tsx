import { type JSX, Show, createContext, createSignal, useContext } from "solid-js";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";

interface DialogOptions {
  title: string;
  description: JSX.Element;
  intent?: "delete" | "confirm";
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType>();

export function DialogProvider(props: { children: JSX.Element }) {
  const [dialogOptions, setDialogOptions] = createSignal<DialogOptions | null>(null);
  let resolvePromise: ((value: boolean) => void) | null = null;

  const showDialog = (options: DialogOptions): Promise<boolean> => {
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
    <DialogContext.Provider value={{ showDialog }}>
      {props.children}
      <Show when={dialogOptions()}>
        {(dialogOptions) => (
          <Dialog onClose={() => handleClose(false)} title={dialogOptions()?.title ?? ""}>
            <Dialog.Description>{dialogOptions()?.description}</Dialog.Description>
            <div class="mt-4 flex justify-end gap-2">
              <Button onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={() => handleClose(true)} intent={dialogOptions()?.intent === "delete" ? "danger" : "gradient"}>
                Confirm
              </Button>
            </div>
          </Dialog>
        )}
      </Show>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
