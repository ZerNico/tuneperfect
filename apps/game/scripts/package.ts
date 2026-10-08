/**
 * Builds and packages the app with electron-builder for the current platform — the same
 * steps locally and in CI:
 *   bun scripts/package.ts [--arch arm64|x64] [--dir]
 * Builds the renderer, the main process and a release native addon for the target arch
 * (cross-compiling if it differs from the host), then packages. `--dir` only produces the
 * unpacked app. The version comes from `TUNEPERFECT_VERSION` (set by CI from the release
 * tag) or package.json.
 *
 * Release files keep the names the Tauri builds used, since the website's download pages
 * and the API's update endpoint refer to them.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type FuseV1Config, FuseV1Options, FuseVersion } from "@electron/fuses";
import { Arch, build, type Configuration, Platform } from "electron-builder";

import { APP_ID, COPYRIGHT, PRODUCT_NAME } from "../electron/identity";
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
const productName = PRODUCT_NAME;
/** The binary in `Tune Perfect.app/Contents/MacOS`, named like the Tauri version's. */
const MAC_EXECUTABLE = "tuneperfect";

/** The Rust target and the addon file the napi build produces for it. */
const native = (() => {
  const targets: Record<string, { rustTarget: string; addon: string }> = {
    "darwin-arm64": { rustTarget: "aarch64-apple-darwin", addon: "tuneperfect-native.darwin-arm64.node" },
    "darwin-x64": { rustTarget: "x86_64-apple-darwin", addon: "tuneperfect-native.darwin-x64.node" },
    "win32-arm64": { rustTarget: "aarch64-pc-windows-msvc", addon: "tuneperfect-native.win32-arm64-msvc.node" },
    "win32-x64": { rustTarget: "x86_64-pc-windows-msvc", addon: "tuneperfect-native.win32-x64-msvc.node" },
    "linux-arm64": { rustTarget: "aarch64-unknown-linux-gnu", addon: "tuneperfect-native.linux-arm64-gnu.node" },
    "linux-x64": { rustTarget: "x86_64-unknown-linux-gnu", addon: "tuneperfect-native.linux-x64-gnu.node" },
  };
  const target = targets[`${process.platform}-${archName}`];
  if (!target) throw new Error(`Unsupported platform: ${process.platform}-${archName}`);
  return target;
})();

function run(command: string, commandArgs: string[]) {
  execFileSync(command, commandArgs, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}
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

  // Only the addon for this target; builds for other architectures may sit next to it.
  const nativeDir = path.join(root, "native");
  for (const file of ["index.cjs", native.addon]) {
    fs.copyFileSync(path.join(nativeDir, file), path.join(stageDir, "native", file));
  }

  const stagedPackage = {
    name: "tuneperfect",
    productName,
    version,
    description: "Karaoke game",
    author: { name: PRODUCT_NAME, email: "support@tuneperfect.org" },
    homepage: "https://tuneperfect.org",
    main: "dist-electron/main.cjs",
  };
  fs.writeFileSync(path.join(stageDir, "package.json"), JSON.stringify(stagedPackage, null, 2));
}

/**
 * The Tauri version's deb and rpm were named `tune-perfect` and installed `/usr/bin/tuneperfect`
 * too. Installing this package removes it (the data moves over on first launch); the Tauri
 * updater never updated these installs, so this is how they leave Tauri.
 */
const replacesTauriPackage = ["--conflicts", "tune-perfect", "--replaces", "tune-perfect"];

/** Hardening switches compiled into the Electron binary. */
const fuses: FuseV1Config = {
  version: FuseVersion.V1,
  // Nobody can run the shipped binary as a plain Node.js process, pass it Node options
  // or attach Node's inspector.
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  // App code is only loaded from app.asar, and only if it matches the build.
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  // The app is served from app://, never file://.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  // Left off on purpose: macOS keeps the key in the Keychain tied to the code signature,
  // and ad-hoc signatures change every release, so players would get a Keychain prompt
  // after each update.
  [FuseV1Options.EnableCookieEncryption]: false,
};

const config: Configuration = {
  appId: APP_ID,
  productName,
  copyright: COPYRIGHT,
  electronVersion,
  directories: { output: outputDir, buildResources: path.join(root, "resources") },
  asar: true,
  // Native addons can't be loaded from inside the archive.
  asarUnpack: ["**/*.node"],
  npmRebuild: false,
  nodeGypRebuild: false,
  mac: {
    category: "public.app-category.music",
    // An Icon Composer icon, so macOS 26 shows it as a proper app icon instead of putting it
    // on a gray tile. electron-builder compiles it with Xcode's actool (Xcode 26 or later)
    // and derives the .icns older macOS versions use from it.
    icon: path.join(root, "resources/icons/icon.icon"),
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
    fpm: replacesTauriPackage,
  },
  rpm: {
    artifactName: `${productName}-${version}-1.${releaseArch.rpm}.rpm`,
    depends: ["alsa-lib"],
    fpm: replacesTauriPackage,
  },
  publish: null,

  afterPack: async (context) => {
    // Applied here instead of through `electronFuses`, which electron-builder runs after
    // this hook: flipping fuses modifies the binary, so it has to happen before signing.
    await context.packager.addElectronFuses(context, fuses);

    if (context.electronPlatformName === "darwin") {
      const app = path.join(context.appOutDir, `${productName}.app`);

      // The binary inside the bundle keeps the Tauri version's name, which tools like the
      // USDB Syncer launch directly. electron-builder's `executableName` would rename the
      // bundle too, so only the binary and Info.plist change. Linux already uses this name.
      const macosDir = path.join(app, "Contents", "MacOS");
      fs.renameSync(path.join(macosDir, productName), path.join(macosDir, MAC_EXECUTABLE));
      execFileSync("plutil", [
        "-replace",
        "CFBundleExecutable",
        "-string",
        MAC_EXECUTABLE,
        path.join(app, "Contents", "Info.plist"),
      ]);

      // Ad-hoc signature, like the Tauri builds had: required for Apple Silicon to run the app.
      execFileSync("codesign", ["--force", "--deep", "--sign", "-", app]);
    }
  },
};

const platform =
  process.platform === "darwin" ? Platform.MAC : process.platform === "win32" ? Platform.WINDOWS : Platform.LINUX;

run("bun", ["run", "build:vite"]);
run("bun", ["run", "build:electron"]);
run("bun", ["run", "native:build:release", "--target", native.rustTarget]);
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
