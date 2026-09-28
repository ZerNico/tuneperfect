import { native } from "~/lib/native/client";

import { desktop } from "./desktop";

export async function getVersion(): Promise<string> {
  return desktop.version;
}

export async function exit(code?: number): Promise<void> {
  await native.app.exit({ code });
}

export async function relaunch(): Promise<void> {
  await native.app.relaunch();
}

export async function openUrl(url: string): Promise<void> {
  await native.app.openUrl({ url });
}

/** Song folders passed with `--songpath`/`-s`, or `null` when none were given. */
export function getSongPathArgs(): Promise<string[] | null> {
  return native.app.songPaths();
}
