import type { JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";

interface PopupConfig {
  render: (resolve: (value: unknown) => void) => JSX.Element;
  modal?: boolean;
}

interface PopupState {
  id: string;
  config: Required<PopupConfig>;
  resolve: (value: unknown) => void;
}

const [popupStack, setPopupStack] = createStore<PopupState[]>([]);

function show<T>(config: PopupConfig): Promise<T> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const popupConfig: Required<PopupConfig> = {
      modal: true,
      ...config,
    };

    setPopupStack(
      produce((stack) => {
        stack.push({
          id,
          config: popupConfig,
          resolve: (value) => {
            setPopupStack((s) => s.filter((p) => p.id !== id));
            resolve(value as T);
          },
        });
      }),
    );
  });
}

export const popup = { show, stack: popupStack };
