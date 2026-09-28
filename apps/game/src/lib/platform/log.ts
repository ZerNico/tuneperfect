import { native } from "~/lib/native/client";

export async function warn(message: string): Promise<void> {
  await native.app.log({ level: "warn", message });
}

export async function error(message: string): Promise<void> {
  await native.app.log({ level: "error", message });
}
