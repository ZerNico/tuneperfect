import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import electronPath from "electron";
import * as esbuild from "esbuild";

import { electronBuildOptions } from "./build-electron";

/**
 * Development loop: starts Vite, bundles the main process in watch mode, rebuilds the native
 * addon when its Rust sources change (regenerating `src/lib/native/types.gen.ts` too), and
 * (re)starts Electron whenever the main process or the addon changed. Arguments are passed
 * on to the app, e.g. `-- --songpath <dir>`.
 */
const DEV_SERVER_URL = "http://localhost:1420";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = path.join(root, "native");
/** Builds land here first; see `buildNative`. */
const nativeBuildDir = path.join(nativeDir, ".build");
const typesFile = path.join(root, "src/lib/native/types.gen.ts");

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    spawn(command, args, { cwd: root, stdio: "inherit" }).on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

async function waitForServer(url: string) {
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Builds the addon into a staging directory, then moves the files into place. Renaming
 * gives the new library a new inode, so the copy a running Electron has loaded is never
 * overwritten (on macOS that can crash the process).
 */
async function buildNative() {
  fs.rmSync(nativeBuildDir, { recursive: true, force: true });
  await run("bunx", [
    "napi",
    "build",
    "--platform",
    "--manifest-path",
    "native/Cargo.toml",
    "--output-dir",
    nativeBuildDir,
    "--js",
    "index.cjs",
    "--dts",
    "index.d.ts",
    "--features",
    "typegen",
  ]);
  for (const file of fs.readdirSync(nativeBuildDir)) {
    fs.renameSync(path.join(nativeBuildDir, file), path.join(nativeDir, file));
  }

  // The dev build exports the renderer's types itself, so this needs no second compile.
  // A fresh process loads the new addon; the file is only rewritten if the types changed.
  await run("bun", ["-e", `require("./native/index.cjs").exportTypescriptTypes(${JSON.stringify(typesFile)})`]);
}

await buildNative();

const vite = spawn("bun", ["run", "dev:vite"], { cwd: root, stdio: "inherit" });
await waitForServer(DEV_SERVER_URL);

let electron: ChildProcess | undefined;
let restarting = false;
let context: esbuild.BuildContext | undefined;
let watcher: fs.FSWatcher | undefined;

function shutdown(code: number) {
  watcher?.close();
  void context?.dispose();
  vite.kill();
  electron?.kill();
  process.exit(code);
}

function startElectron() {
  // Terminals inside Electron-based editors can leak this, which would start Electron as
  // plain Node instead of the app.
  const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
  electron = spawn(electronPath as unknown as string, [".", ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
    env: { ...env, TUNEPERFECT_DEV_SERVER_URL: DEV_SERVER_URL },
  });
  electron.on("exit", (code) => {
    if (!restarting) shutdown(code ?? 0);
  });
}

function restartElectron() {
  if (!electron || electron.exitCode !== null) return startElectron();

  restarting = true;
  electron.once("exit", () => {
    restarting = false;
    startElectron();
  });
  electron.kill();
}

context = await esbuild.context({
  ...electronBuildOptions,
  plugins: [
    {
      name: "restart-electron",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) restartElectron();
        });
      },
    },
  ],
});
await context.watch();

// Rust changes: rebuild, then restart, since a loaded addon can't be replaced in place.
// Changes during a build queue exactly one more; a failed build keeps the app running.
let building = false;
let queued = false;
let debounce: NodeJS.Timeout | undefined;

async function rebuildNative() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  console.log("\n[dev] Rust sources changed, rebuilding the native addon…");
  try {
    await buildNative();
    console.log("[dev] Native addon rebuilt, restarting Electron");
    restartElectron();
  } catch {
    console.log("[dev] Native build failed; the app keeps running the previous build");
  } finally {
    building = false;
    if (queued) {
      queued = false;
      void rebuildNative();
    }
  }
}

watcher = fs.watch(nativeDir, { recursive: true }, (_event, file) => {
  const changed = file?.toString() ?? "";
  if (!(changed.startsWith(`src${path.sep}`) || changed === "Cargo.toml" || changed === "build.rs")) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => void rebuildNative(), 300);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
