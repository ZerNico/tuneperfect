import { native } from "~/lib/native/client";
import type { DialogFilter } from "~/lib/native/contract";

interface OpenOptions {
  directory?: boolean;
  /** Accepted for compatibility; folder access always includes subfolders. */
  recursive?: boolean;
  multiple?: boolean;
  filters?: DialogFilter[];
}

/** Shows the native open dialog. Picked folders are granted to the app for song access. */
export async function open(options: OpenOptions & { multiple: true }): Promise<string[] | null>;
export async function open(options?: OpenOptions): Promise<string | null>;
export async function open(options: OpenOptions = {}): Promise<string | string[] | null> {
  const paths = await native.dialog.open({
    directory: options.directory,
    multiple: options.multiple,
    filters: options.filters,
  });
  if (!paths) return null;
  return options.multiple ? paths : (paths[0] ?? null);
}
