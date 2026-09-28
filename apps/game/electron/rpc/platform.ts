import fsp from "node:fs/promises";
import path from "node:path";

import { app, dialog } from "electron";

import type { UpdateInstallEvent } from "../../src/lib/native/contract";
import { native } from "../native";
import type { JsonStores } from "../store";
import { checkForUpdate, installUpdate } from "../updater";
import { os, stream } from "./base";

export interface PlatformDependencies {
  stores: JsonStores;
  songPaths: string[] | null;
  log: (level: "warn" | "error", message: string) => void;
}

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** App and OS services: stores, dialogs, the window, updates. */
export function platformProcedures({ stores, songPaths, log }: PlatformDependencies) {
  return {
    store: {
      read: os.store.read.handler(({ input }) => stores.read(input.file)),
      write: os.store.write.handler(({ input }) => stores.write(input.file, input.data)),
    },
    dialog: {
      pickFolder: os.dialog.pickFolder.handler(async ({ context }) => {
        const options: Electron.OpenDialogOptions = { properties: ["openDirectory"] };
        const result = context.window
          ? await dialog.showOpenDialog(context.window, options)
          : await dialog.showOpenDialog(options);
        const folder = result.canceled ? undefined : result.filePaths[0];
        if (!folder || !native.allowDirectory(folder)) return null;
        return folder;
      }),
      pickImage: os.dialog.pickImage.handler(async ({ context }) => {
        const options: Electron.OpenDialogOptions = {
          properties: ["openFile"],
          filters: [{ name: "Images", extensions: Object.keys(IMAGE_TYPES).map((ext) => ext.slice(1)) }],
        };
        const result = context.window
          ? await dialog.showOpenDialog(context.window, options)
          : await dialog.showOpenDialog(options);
        const file = result.canceled ? undefined : result.filePaths[0];
        const type = file && IMAGE_TYPES[path.extname(file).toLowerCase()];
        if (!file || !type) return null;
        return `data:${type};base64,${(await fsp.readFile(file)).toString("base64")}`;
      }),
    },
    window: {
      toggleFullscreen: os.window.toggleFullscreen.handler(({ context }) => {
        context.window?.setFullScreen(!context.window.isFullScreen());
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
      log: os.app.log.handler(({ input }) => log(input.level, input.message)),
    },
  };
}
