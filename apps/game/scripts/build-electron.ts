import fs from "node:fs/promises";
import path from "node:path";

import type { BuildOptions, Plugin } from "esbuild";
import * as esbuild from "esbuild";

/** `import text from "./file?raw"` as in Vite: the file's contents as a string. */
const rawImports: Plugin = {
  name: "raw-imports",
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.slice(0, -"?raw".length)),
      namespace: "raw",
    }));
    build.onLoad({ filter: /.*/, namespace: "raw" }, async (args) => ({
      contents: await fs.readFile(args.path, "utf8"),
      loader: "text",
      watchFiles: [args.path],
    }));
  },
};

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
  plugins: [rawImports],
  // Fixed at build time: update configuration (`electron/updater.ts`) and the API origin.
  define: {
    "process.env.TUNEPERFECT_UPDATE_ENDPOINT": JSON.stringify(process.env.TUNEPERFECT_UPDATE_ENDPOINT ?? ""),
    "process.env.TUNEPERFECT_UPDATE_PUBKEY": JSON.stringify(process.env.TUNEPERFECT_UPDATE_PUBKEY ?? ""),
    // The renderer's API, allowed by the CSP (`electron/csp.ts`).
    "process.env.TUNEPERFECT_API_URL": JSON.stringify(process.env.VITE_API_URL ?? ""),
  },
};

if (import.meta.main) {
  await esbuild.build(electronBuildOptions);
}
