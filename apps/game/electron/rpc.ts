import fsp from "node:fs/promises";

import { implement, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";
import { app, type BrowserWindow, dialog, ipcMain, shell, systemPreferences } from "electron";

import {
  contract,
  type ParseSongsEvent,
  type UpdateInstallEvent,
  type UsdbCatalogEvent,
} from "../src/lib/native/contract";
import type { SongGroup, UsdbSearchEntry } from "../src/lib/native/types";
import type { SongFolderAccess } from "./allowlist";
import { native, parseAppError } from "./native";
import type { JsonStores } from "./store";
import { checkForUpdate, installUpdate } from "./updater";

export interface RpcContext {
  window: BrowserWindow | null;
}

export interface RpcDependencies {
  stores: JsonStores;
  songFolders: SongFolderAccess;
  songPaths: string[] | null;
  log: (level: "warn" | "error", message: string) => void;
}

/** Channel the preload forwards the renderer's MessagePort on. */
export const CONNECT_CHANNEL = "tp:connect-rpc";

/**
 * macOS attributes microphone access to the app bundle. Asking explicitly shows the
 * prompt; without it CoreAudio can silently deliver zeros.
 */
async function ensureMicrophoneAccess(): Promise<void> {
  if (process.platform !== "darwin") return;
  if (systemPreferences.getMediaAccessStatus("microphone") === "granted") return;
  await systemPreferences.askForMediaAccess("microphone");
}

/**
 * Turns a callback-driven call into an async generator: everything the callback receives
 * is yielded in order, followed by `done(result)` (if given) once the call resolves.
 */
async function* stream<E, R>(run: (emit: (event: E) => void) => Promise<R>, done?: (result: R) => E) {
  const queue: E[] = [];
  let wake: (() => void) | undefined;
  let outcome: { ok: true; value: R } | { ok: false; error: unknown } | undefined;

  const notify = () => {
    wake?.();
    wake = undefined;
  };

  run((event) => {
    queue.push(event);
    notify();
  }).then(
    (value) => {
      outcome = { ok: true, value };
      notify();
    },
    (error: unknown) => {
      outcome = { ok: false, error };
      notify();
    },
  );

  while (true) {
    while (queue.length > 0) yield queue.shift() as E;
    if (outcome) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  if (!outcome.ok) throw outcome.error;
  if (done) yield done(outcome.value);
}

export function createRpcHandler({ stores, songFolders, songPaths, log }: RpcDependencies) {
  const os = implement(contract).$context<RpcContext>();

  /** Files the user picked through the dialog in this session; the only ones `fs.readFile` serves. */
  const pickedFiles = new Set<string>();

  // Every native failure becomes the typed NATIVE_ERROR the contract declares.
  const call = os.middleware(async ({ next, errors }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ORPCError) throw error;
      const appError = parseAppError(error);
      throw errors.NATIVE_ERROR({ message: appError.data, data: appError });
    }
  });

  const router = os.use(call).router({
    microphones: {
      list: os.microphones.list.handler(async () => {
        await ensureMicrophoneAccess();
        return native.getMicrophones();
      }),
    },
    recording: {
      start: os.recording.start.handler(async ({ input }) => {
        await ensureMicrophoneAccess();
        await native.startRecording(input.microphones, input.playbackEnabled, input.playbackVolume);
      }),
      stop: os.recording.stop.handler(() => native.stopRecording()),
    },
    pitch: {
      get: os.pitch.get.handler(({ input }) => native.getPitches(input.windowMs)),
      levels: os.pitch.levels.handler(() => native.getAudioLevels()),
    },
    songs: {
      parse: os.songs.parse.handler(({ input }) =>
        stream<ParseSongsEvent, SongGroup[]>(
          (emit) => native.parseSongsFromPaths(input.paths, emit),
          (groups) => ({ type: "done", groups }),
        ),
      ),
    },
    localServer: {
      baseUrl: os.localServer.baseUrl.handler(() => native.getLocalServerBaseUrl()),
    },
    usdb: {
      login: os.usdb.login.handler(({ input }) => native.usdbLogin(input.username, input.password)),
      logout: os.usdb.logout.handler(() => native.usdbLogout()),
      isLoggedIn: os.usdb.isLoggedIn.handler(() => native.usdbIsLoggedIn()),
      fetchCatalog: os.usdb.fetchCatalog.handler(({ input }) =>
        stream<UsdbCatalogEvent, UsdbSearchEntry[]>(
          (emit) =>
            native.usdbFetchCatalog(input.lastMtime, input.lastSongIds, (progress) =>
              emit({ type: "progress", ...progress }),
            ),
          (catalog) => ({ type: "done", catalog }),
        ),
      ),
      getSong: os.usdb.getSong.handler(({ input }) => native.usdbGetSong(input.songId)),
      getSongPreview: os.usdb.getSongPreview.handler(({ input }) => native.usdbGetSongPreview(input.songId)),
    },
    store: {
      entries: os.store.entries.handler(({ input }) => stores.entries(input.file)),
      get: os.store.get.handler(({ input }) => stores.get(input.file, input.key)),
      set: os.store.set.handler(({ input }) => stores.set(input.file, input.key, input.value)),
      delete: os.store.delete.handler(({ input }) => stores.delete(input.file, input.key)),
      save: os.store.save.handler(({ input }) => stores.save(input.file)),
    },
    dialog: {
      open: os.dialog.open.handler(async ({ input, context }) => {
        const properties: Electron.OpenDialogOptions["properties"] = [input.directory ? "openDirectory" : "openFile"];
        if (input.multiple) properties.push("multiSelections");

        const options: Electron.OpenDialogOptions = { properties, filters: input.filters };
        const result = context.window
          ? await dialog.showOpenDialog(context.window, options)
          : await dialog.showOpenDialog(options);
        if (result.canceled) return null;

        for (const picked of result.filePaths) {
          if (input.directory) await songFolders.grant(picked);
          else pickedFiles.add(picked);
        }
        return result.filePaths;
      }),
    },
    fs: {
      readFile: os.fs.readFile.handler(async ({ input }) => {
        if (!pickedFiles.has(input.path)) throw new Error(`Not a file picked in this session: ${input.path}`);
        return (await fsp.readFile(input.path)).toString("base64");
      }),
    },
    window: {
      isFullscreen: os.window.isFullscreen.handler(({ context }) => context.window?.isFullScreen() ?? false),
      setFullscreen: os.window.setFullscreen.handler(({ input, context }) => {
        context.window?.setFullScreen(input.fullscreen);
      }),
    },
    updates: {
      check: os.updates.check.handler(async () => {
        const update = await checkForUpdate();
        return update ? { version: update.version } : null;
      }),
      install: os.updates.install.handler(() =>
        stream<UpdateInstallEvent, void>((emit) =>
          installUpdate((progress) => emit({ type: "progress", ...progress })),
        ),
      ),
    },
    app: {
      songPaths: os.app.songPaths.handler(() => songPaths),
      exit: os.app.exit.handler(({ input }) => {
        app.exit(input.code ?? 0);
      }),
      openUrl: os.app.openUrl.handler(async ({ input }) => {
        if (!/^https?:/.test(input.url)) throw new Error("Only http(s) URLs can be opened");
        await shell.openExternal(input.url);
      }),
      log: os.app.log.handler(({ input }) => log(input.level, input.message)),
    },
  });

  return new RPCHandler(router);
}

/** Serves the contract on every MessagePort a window's preload forwards. */
export function listenForRpc(
  handler: ReturnType<typeof createRpcHandler>,
  windowFor: (id: number) => BrowserWindow | null,
) {
  ipcMain.on(CONNECT_CHANNEL, (event) => {
    const [port] = event.ports;
    if (!port) return;
    handler.upgrade(port, { context: { window: windowFor(event.sender.id) } });
    port.start();
  });
}
