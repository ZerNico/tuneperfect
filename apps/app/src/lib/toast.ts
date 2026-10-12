import { Toast } from "base-ui-solid/toast";

export type ToastIntent = "success" | "error" | "info" | "warning";

/** Shared with `ToastRegion`, so toasts can be queued from anywhere, also outside components. */
export const toastManager = Toast.createToastManager();

interface NotifyOptions {
  message?: string;
  intent?: ToastIntent;
}

export function notify(options: NotifyOptions = {}) {
  return toastManager.add({ type: options.intent ?? "info", description: options.message ?? "" });
}
