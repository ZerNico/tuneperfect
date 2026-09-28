import fsp from "node:fs/promises";

import { app, dialog, shell } from "electron";

import type { UpdateInstallEvent } from "../../src/lib/native/contract";
import type { SongFolderAccess } from "../allowlist";
import type { JsonStores } from "../store";
import { checkForUpdate, installUpdate } from "../updater";
import { os, stream } from "./base";

export interface PlatformDependencies {
  stores: JsonStores;
  songFolders: SongFolderAccess;
  songPaths: string[] | null;
  log: (level: "warn" | "error", message: string) => void;
}

/** App and OS services the Tauri plugins used to provide. */
export function platformProcedures({ stores, songFolders, songPaths, log }: PlatformDependencies) {
  /** Files the user picked through the dialog in this session; the only ones `fs.readFile` serves. */
  const pickedFiles = new Set<string>();

  return {
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
      // Quit normally so pending store writes are flushed and recording stops first.
      exit: os.app.exit.handler(() => {
        app.quit();
      }),
      openUrl: os.app.openUrl.handler(async ({ input }) => {
        if (!/^https?:/.test(input.url)) throw new Error("Only http(s) URLs can be opened");
        await shell.openExternal(input.url);
      }),
      log: os.app.log.handler(({ input }) => log(input.level, input.message)),
    },
  };
}
