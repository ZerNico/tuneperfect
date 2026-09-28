import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, net, protocol, session, shell, webContents } from "electron";

import { SongFolderAccess } from "./allowlist";
import { CONTENT_SECURITY_POLICY } from "./csp";
import { native } from "./native";
import { storeDir } from "./paths";
import { createRpcHandler, listenForRpc } from "./rpc";
import { JsonStores } from "./store";

/** Set by the dev script; packaged and preview builds load the bundled frontend instead. */
const devServerUrl = process.env.TUNEPERFECT_DEV_SERVER_URL;

const APP_SCHEME = "app";
const APP_ORIGIN = `${APP_SCHEME}://tuneperfect`;
const appUrl = devServerUrl ?? `${APP_ORIGIN}/`;
const appOrigin = new URL(appUrl).origin;

const rendererDir = path.join(__dirname, "../dist");

app.setName("Tune Perfect");

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/** `--songpath <dir>` / `-s <dir>`, repeatable, like the Tauri CLI plugin accepted. */
function songPathArgs(argv: string[]): string[] | null {
  const paths: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--songpath" || arg === "-s") && next) {
      paths.push(next);
      i++;
    } else if (arg?.startsWith("--songpath=")) {
      paths.push(arg.slice("--songpath=".length));
    }
  }
  return paths.length > 0 ? paths : null;
}

/** Serves the built frontend from `dist/`, falling back to `index.html` for client-side routes. */
function serveRenderer() {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const requested = path.normalize(path.join(rendererDir, decodeURIComponent(pathname)));
    const insideRenderer = requested.startsWith(rendererDir + path.sep);
    const file =
      insideRenderer && fs.statSync(requested, { throwIfNoEntry: false })?.isFile()
        ? requested
        : path.join(rendererDir, "index.html");

    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: "Tune Perfect",
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // The game clock runs on requestAnimationFrame and media time; don't let Chromium
      // throttle it when the window is occluded.
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: [`--tp-version=${app.getVersion()}`],
    },
  });

  window.once("ready-to-show", () => window.show());

  // Links to other sites open in the browser; the app window never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== appOrigin) event.preventDefault();
  });

  void window.loadURL(appUrl);
  return window;
}

async function start() {
  const stores = new JsonStores(storeDir());
  const songFolders = new SongFolderAccess(stores);
  const songPaths = songPathArgs(process.argv);
  await songFolders.restore(songPaths ?? []);

  // The embed page on the media server may only be framed by the app itself.
  await native.startLocalServer([appOrigin]);

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    const trusted = new URL(contents.getURL()).origin === appOrigin;
    callback(trusted && (permission === "fullscreen" || permission === "screen-wake-lock"));
  });

  if (!devServerUrl) serveRenderer();

  const rpc = createRpcHandler({
    stores,
    songFolders,
    songPaths,
    log: (level, message) => (level === "error" ? console.error : console.warn)(`[webview] ${message}`),
  });
  listenForRpc(rpc, (id) => {
    const contents = webContents.fromId(id);
    return contents ? BrowserWindow.fromWebContents(contents) : null;
  });

  let quitting = false;
  app.on("before-quit", (event) => {
    stores.flushSync();
    if (quitting) return;
    // Stop capture before the addon is torn down with the process.
    quitting = true;
    event.preventDefault();
    void native
      .stopRecording()
      .catch(() => {})
      .finally(() => app.quit());
  });

  const window = createWindow();
  app.on("second-instance", () => {
    if (window.isMinimized()) window.restore();
    window.focus();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("window-all-closed", () => app.quit());
  app.whenReady().then(start, (error: unknown) => {
    console.error("Failed to start:", error);
    app.exit(1);
  });
}
