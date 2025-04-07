import { toaster } from "@kobalte/core/toast";
import Toast from "~/components/ui/toast";

interface NotifyOptions {
  message?: string;
  intent?: "success" | "error" | "info" | "warning";
}

export function notify(options: NotifyOptions = {}) {
  return toaster.show((props) => <Toast toastId={props.toastId} message={options.message || ""} intent={options.intent || "info"} />);
}
