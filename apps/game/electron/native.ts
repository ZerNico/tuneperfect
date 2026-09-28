import { createRequire } from "node:module";
import path from "node:path";

import type * as NativeModule from "../native/index";

export type Native = typeof NativeModule;

/**
 * The napi-rs addon. Loaded at runtime rather than bundled: the generated loader picks the
 * `.node` binary for this platform and architecture. `dist-electron/` and `native/` sit
 * next to each other both in the repo and in the packaged app.
 */
export const native: Native = createRequire(__filename)(path.join(__dirname, "../native/index.cjs"));

/** Serialized `AppError` as the addon puts it in a rejected call's message. */
export interface AppError {
  type: string;
  data: string;
}

export function parseAppError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "type" in parsed && "data" in parsed) {
      return { type: String(parsed.type), data: String(parsed.data) };
    }
  } catch {
    // Not one of ours: argument validation and runtime failures carry plain messages.
  }
  return { type: "IoError", data: message };
}
