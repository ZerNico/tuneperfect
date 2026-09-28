/**
 * Packages the built app with electron-builder for the current platform:
 *   bun scripts/package.ts [--arch arm64|x64] [--dir]
 * Expects `vite build`, `build:electron` and a native build for the target arch to have
 * run. `--dir` only produces the unpacked app. The version comes from
 * `TUNEPERFECT_VERSION` (set by CI from the release tag) or package.json.
 *
 * Release files keep the names the Tauri builds used, since the website's download pages
 * and the API's update endpoint refer to them.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Arch, build, type Configuration, Platform } from "electron-builder";

import packageJson from "../package.json";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = path.join(root, ".electron-app");
const outputDir = path.join(root, "release");

const args = process.argv.slice(2);
const archName = args.includes("--arch") ? args[args.indexOf("--arch") + 1] : process.arch;
if (archName !== "arm64" && archName !== "x64") throw new Error(`Unsupported arch: ${archName}`);
const arch = archName === "arm64" ? Arch.arm64 : Arch.x64;
const dirOnly = args.includes("--dir");

const version = (process.env.TUNEPERFECT_VERSION ?? packageJson.version).replace(/^v/, "");
const productName = "Tune Perfect";
const electronVersion: string = (await import("electron/package.json")).default.version;

/** Arch spellings the Tauri release files used, per platform and format. */
const releaseArch = {
  mac: archName === "arm64" ? "aarch64" : "x64",
  windows: archName,
  linux: archName === "arm64" ? "arm64" : "amd64",
  rpm: archName === "arm64" ? "aarch64" : "x86_64",
};

/**
 * Stages a self-contained app directory: everything is bundled, so it needs no
 * node_modules, and electron-builder doesn't have to understand the Bun workspace.
 */
function stage() {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stageDir, "native"), { recursive: true });

  for (const dir of ["dist", "dist-electron"]) {
    fs.cpSync(path.join(root, dir), path.join(stageDir, dir), { recursive: true });
  }

  const nativeDir = path.join(root, "native");
  const addons = fs.readdirSync(nativeDir).filter((file) => file.endsWith(".node"));
  if (addons.length === 0) throw new Error("No native addon found; run the native build first");
  for (const file of ["index.cjs", ...addons]) {
    fs.copyFileSync(path.join(nativeDir, file), path.join(stageDir, "native", file));
  }

  const stagedPackage = {
    name: "tuneperfect",
    productName,
    version,
    description: "Karaoke game",
    author: { name: "Tune Perfect", email: "hello@tuneperfect.org" },
    homepage: "https://tuneperfect.org",
    main: "dist-electron/main.cjs",
  };
  fs.writeFileSync(path.join(stageDir, "package.json"), JSON.stringify(stagedPackage, null, 2));
}

const config: Configuration = {
  appId: "org.tuneperfect.game",
  productName,
  electronVersion,
  directories: { output: outputDir, buildResources: path.join(root, "resources") },
  asar: true,
  // Native addons can't be loaded from inside the archive.
  asarUnpack: ["**/*.node"],
  npmRebuild: false,
  nodeGypRebuild: false,
  mac: {
    category: "public.app-category.music",
    icon: path.join(root, "resources/icons/icon.icns"),
    // There's no Developer ID yet: skip electron-builder's signing, which would pick up any
    // certificate in the local keychain, and sign ad-hoc in `afterPack` instead.
    identity: null,
    extendInfo: { NSMicrophoneUsageDescription: "Tune Perfect uses the microphone to score your singing." },
    minimumSystemVersion: "12.0",
    target: dirOnly ? ["dir"] : ["dmg"],
  },
  dmg: { artifactName: `${productName}_${version}_${releaseArch.mac}.dmg` },
  win: {
    icon: path.join(root, "resources/icons/icon.ico"),
    target: dirOnly ? ["dir"] : ["nsis"],
  },
  nsis: {
    artifactName: `${productName}_${version}_${releaseArch.windows}-setup.exe`,
    oneClick: true,
    perMachine: false,
  },
  linux: {
    icon: path.join(root, "resources/icons/icon.png"),
    category: "AudioVideo",
    target: dirOnly ? ["dir"] : ["AppImage", "deb", "rpm"],
  },
  appImage: { artifactName: `${productName}_${version}_${releaseArch.linux}.AppImage` },
  deb: {
    artifactName: `${productName}_${version}_${releaseArch.linux}.deb`,
    // cpal records through ALSA.
    depends: ["libasound2 | libasound2t64"],
  },
  rpm: {
    artifactName: `${productName}-${version}-1.${releaseArch.rpm}.rpm`,
    depends: ["alsa-lib"],
  },
  publish: null,
  // Ad-hoc signature, like the Tauri builds had: required for Apple Silicon to run the app.
  afterPack: async (context) => {
    if (context.electronPlatformName !== "darwin") return;
    const app = path.join(context.appOutDir, `${productName}.app`);
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", app]);
  },
};

const platform =
  process.platform === "darwin" ? Platform.MAC : process.platform === "win32" ? Platform.WINDOWS : Platform.LINUX;

stage();
// Building from the staging directory keeps the workspace's node_modules out of the app.
await build({ projectDir: stageDir, targets: platform.createTarget(null, arch), config });

// The in-app updater on macOS installs from a gzipped tarball of the .app bundle, the same
// format Tauri's updater used.
if (platform === Platform.MAC && !dirOnly) {
  const appDir = path.join(outputDir, arch === Arch.arm64 ? "mac-arm64" : "mac");
  const archive = path.join(outputDir, `${productName}_${version}_${releaseArch.mac}.app.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", appDir, `${productName}.app`], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  console.log(`created ${path.relative(root, archive)}`);
}
