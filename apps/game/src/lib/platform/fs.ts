import { native } from "~/lib/native/client";

/** Reads a file the user picked with `open()` in this session. */
export async function readFile(path: string): Promise<Uint8Array<ArrayBuffer>> {
  const base64 = await native.fs.readFile({ path });
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
