import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { app } from "electron";

import { verifyMinisign } from "./minisign";

/**
 * In-app updates in the model Tauri's updater used, which works without Apple/Microsoft
 * code signing: the API names a release file and its minisign signature, the download is
 * verified against the public key baked in at build time, then installed per platform:
 * macOS swaps the .app bundle, Linux replaces the AppImage, Windows runs the installer.
 *
 * Configured at build time (see `scripts/build-electron.ts`); without both values, and in
 * development, there are never updates.
 */
const ENDPOINT = process.env.TUNEPERFECT_UPDATE_ENDPOINT ?? "";
const PUBLIC_KEY = process.env.TUNEPERFECT_UPDATE_PUBKEY ?? "";

export interface UpdateInfo {
  version: string;
  url: string;
  signature: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

type Installation =
  | { kind: "macos"; bundle: string }
  | { kind: "appimage"; file: string }
  | { kind: "windows" }
  | { kind: "unsupported" };

/** How this copy was installed decides whether and how it can replace itself. */
function installation(): Installation {
  if (process.platform === "darwin") {
    // …/Tune Perfect.app/Contents/MacOS/<binary>
    const bundle = path.resolve(process.execPath, "../../..");
    return bundle.endsWith(".app") ? { kind: "macos", bundle } : { kind: "unsupported" };
  }
  if (process.platform === "win32") return { kind: "windows" };
  // deb/rpm installs are updated by the package manager.
  const appImage = process.env.APPIMAGE;
  return appImage ? { kind: "appimage", file: appImage } : { kind: "unsupported" };
}

function compareVersions(a: string, b: string): number {
  const parts = (version: string) =>
    version
      .replace(/^v/, "")
      .split("-")[0]!
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

let pending: UpdateInfo | null = null;

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  pending = null;
  if (!app.isPackaged || !ENDPOINT || !PUBLIC_KEY) return null;
  if (installation().kind === "unsupported") return null;

  const target = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const url = ENDPOINT.replace("{{target}}", target)
    .replace("{{arch}}", arch)
    .replace("{{current_version}}", app.getVersion());

  const response = await fetch(url);
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Update check failed: ${response.status}`);

  const update = (await response.json()) as UpdateInfo;
  if (compareVersions(update.version, app.getVersion()) <= 0) return null;

  pending = update;
  return update;
}

async function download(url: string, onProgress: (progress: DownloadProgress) => void): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`);

  const length = Number(response.headers.get("content-length"));
  const total = Number.isFinite(length) && length > 0 ? length : null;
  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  for await (const chunk of response.body) {
    chunks.push(chunk);
    downloaded += chunk.length;
    onProgress({ downloaded, total });
  }

  return Buffer.concat(chunks);
}

/** Replaces the running .app bundle; the process keeps running from the old files until it exits. */
function installMacos(bundle: string, archive: Uint8Array, workDir: string) {
  const archivePath = path.join(workDir, "update.app.tar.gz");
  const extractDir = path.join(workDir, "extracted");
  fs.writeFileSync(archivePath, archive);
  fs.mkdirSync(extractDir);
  execFileSync("tar", ["-xzf", archivePath, "-C", extractDir]);

  const newBundle = fs.readdirSync(extractDir).find((entry) => entry.endsWith(".app"));
  if (!newBundle) throw new Error("Update archive contains no app bundle");
  const source = path.join(extractDir, newBundle);

  try {
    const backup = path.join(workDir, "previous.app");
    execFileSync("mv", [bundle, backup]);
    try {
      execFileSync("ditto", [source, bundle]);
    } catch (error) {
      execFileSync("mv", [backup, bundle]);
      throw error;
    }
  } catch {
    // e.g. /Applications owned by another user: ask for an administrator password, as the
    // Tauri updater did.
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const script = `rm -rf ${quote(bundle)} && ditto ${quote(source)} ${quote(bundle)}`;
    execFileSync("osascript", ["-e", `do shell script ${JSON.stringify(script)} with administrator privileges`]);
  }

  // Nothing downloaded here is quarantined, but a copy made by the user might have been.
  try {
    execFileSync("xattr", ["-dr", "com.apple.quarantine", bundle]);
  } catch {
    // Not quarantined.
  }
}

function installAppImage(file: string, image: Uint8Array) {
  // Written next to the target so the final rename is atomic.
  const temp = `${file}.update`;
  fs.writeFileSync(temp, image, { mode: 0o755 });
  fs.renameSync(temp, file);
}

/**
 * Starts `file` again once this process has exited. `app.relaunch()` can't be used for an
 * AppImage: its helper runs from the AppImage's mount, which disappears when the app quits.
 * Waiting for the exit also keeps the new instance from losing the single-instance lock.
 *
 * The shell first closes every descriptor it inherited besides stdio: Chromium leaves
 * sockets and files from the old AppImage mount open across exec, which would keep the old
 * mount (and its runtime process) alive and hand stale sockets to the new instance. bash
 * because `exec {n}>&-` closes descriptors above 9, which dash can't.
 */
function relaunchAppImage(file: string) {
  const script = [
    'for fd in /proc/$$/fd/*; do n=${fd##*/}; [ "$n" -gt 2 ] && exec {n}>&-; done 2>/dev/null',
    'while kill -0 "$0" 2>/dev/null; do sleep 0.2; done',
    'exec "$@"',
  ].join("; ");
  spawn("/bin/bash", ["-c", script, String(process.pid), file, ...process.argv.slice(1)], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

function runWindowsInstaller(installer: Uint8Array, workDir: string) {
  const setup = path.join(workDir, "setup.exe");
  fs.writeFileSync(setup, installer);
  // Silent install that starts the app again afterwards; the flags electron-builder's
  // NSIS installer understands for updates.
  spawn(setup, ["/S", "--updated", "--force-run"], { detached: true, stdio: "ignore" }).unref();
}

/**
 * Downloads, verifies and installs the update found by the last check, then restarts
 * into it. Resolves only if something failed before the restart.
 */
export async function installUpdate(onProgress: (progress: DownloadProgress) => void): Promise<void> {
  const update = pending;
  if (!update) throw new Error("No update available");
  const target = installation();

  const data = await download(update.url, onProgress);
  if (!verifyMinisign(data, update.signature, PUBLIC_KEY)) {
    throw new Error("Update signature is invalid");
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "tuneperfect-update-"));
  switch (target.kind) {
    case "macos":
      installMacos(target.bundle, data, workDir);
      app.relaunch();
      app.exit(0);
      return;
    case "appimage":
      installAppImage(target.file, data);
      relaunchAppImage(target.file);
      app.exit(0);
      return;
    case "windows":
      runWindowsInstaller(data, workDir);
      app.quit();
      return;
    case "unsupported":
      throw new Error("This installation can't update itself");
  }
}
