import { native } from "~/lib/native/client";

export function isFullscreen(): Promise<boolean> {
  return native.window.isFullscreen();
}

export async function setFullscreen(fullscreen: boolean): Promise<void> {
  await native.window.setFullscreen({ fullscreen });
}
