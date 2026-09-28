import { type ChildProcess, spawn } from "node:child_process";

import electronPath from "electron";
import * as esbuild from "esbuild";

import { electronBuildOptions } from "./build-electron";

/**
 * Development loop: builds the native addon, starts Vite, bundles the main process in
 * watch mode and (re)starts Electron whenever that bundle changes. Rust changes need a
 * restart of this script. Arguments are passed on to the app, e.g. `-- --songpath <dir>`.
 */
const DEV_SERVER_URL = "http://localhost:1420";

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    spawn(command, args, { stdio: "inherit" }).on("exit", (code) =>
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

await run("bun", ["run", "native:build"]);

const vite = spawn("bun", ["run", "dev:vite"], { stdio: "inherit" });
await waitForServer(DEV_SERVER_URL);

let electron: ChildProcess | undefined;
let restarting = false;
let context: esbuild.BuildContext | undefined;

function shutdown(code: number) {
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
    stdio: "inherit",
    env: { ...env, TUNEPERFECT_DEV_SERVER_URL: DEV_SERVER_URL },
  });
  electron.on("exit", (code) => {
    if (!restarting) shutdown(code ?? 0);
  });
}

context = await esbuild.context({
  ...electronBuildOptions,
  plugins: [
    {
      name: "restart-electron",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) return;
          if (!electron) return startElectron();

          restarting = true;
          electron.once("exit", () => {
            restarting = false;
            startElectron();
          });
          electron.kill();
        });
      },
    },
  ],
});
await context.watch();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
