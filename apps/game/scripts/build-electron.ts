import type { BuildOptions } from "esbuild";
import * as esbuild from "esbuild";

/**
 * Bundles the Electron main process and preload script to CommonJS in `dist-electron/`.
 * The native addon is loaded at runtime from `native/`, so it is not part of the bundle.
 */
export const electronBuildOptions: BuildOptions = {
  entryPoints: { main: "electron/main.ts", preload: "electron/preload.ts" },
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
  // Update configuration is fixed at build time; see `electron/updater.ts`.
  define: {
    "process.env.TUNEPERFECT_UPDATE_ENDPOINT": JSON.stringify(process.env.TUNEPERFECT_UPDATE_ENDPOINT ?? ""),
    "process.env.TUNEPERFECT_UPDATE_PUBKEY": JSON.stringify(process.env.TUNEPERFECT_UPDATE_PUBKEY ?? ""),
  },
};

if (import.meta.main) {
  await esbuild.build(electronBuildOptions);
}
