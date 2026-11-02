import { queryOptions } from "@tanstack/solid-query";
import { createSignal } from "solid-js";

import { native } from "~/lib/native/client";

/** The update this installation can install itself, if any (`null` also when it can't update itself). */
export const updateCheckQueryOptions = () =>
  queryOptions({
    queryKey: ["checkUpdate"],
    queryFn: () => native.updates.check(),
    retry: false,
  });

/**
 * Whether this version may still go online. The main process asks the API over plain REST,
 * so this keeps working for games on an older RPC protocol (see `electron/updater.ts`).
 */
export const gameSupportQueryOptions = () =>
  queryOptions({
    queryKey: ["gameSupport"],
    queryFn: () => native.updates.gameSupport(),
    retry: false,
  });

/**
 * Offline for this run only: chosen when this version can't go online any more. Unlike the
 * `forceOfflineMode` setting it's never stored, so the next start asks again.
 */
const [sessionOffline, setSessionOffline] = createSignal(false);

export { sessionOffline };
export const playOfflineThisSession = () => setSessionOffline(true);
