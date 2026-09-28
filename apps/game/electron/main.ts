import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, net, protocol, session, shell, webContents } from "electron";

import { SongFolderAccess } from "./allowlist";
import { CONTENT_SECURITY_POLICY } from "./csp";
import { PRODUCT_NAME } from "./identity";
import { createLogger } from "./logger";
import { setApplicationMenu } from "./menu";
import { native } from "./native";
import { configDir, logDir, storeDir } from "./paths";
import { createRpcHandler, listenForRpc } from "./rpc";
import { JsonStores } from "./store";
import { loadWindowState, saveWindowState } from "./window-state";

/** Set by the dev script; packaged and preview builds load the bundled frontend instead. */
const devServerUrl = process.env.TUNEPERFECT_DEV_SERVER_URL;

const APP_SCHEME = "app";
const APP_ORIGIN = `${APP_SCHEME}://tuneperfect`;
const appUrl = devServerUrl ?? `${APP_ORIGIN}/`;
const appOrigin = new URL(appUrl).origin;

const rendererDir = path.join(__dirname, "../dist");

app.setName(PRODUCT_NAME);
// Chromium's own storage (local storage, cache, cookies) and the single-instance lock live
// in userData, which Electron names after the app. Give development builds their own so
// they don't share it with an installed release.
if (!app.isPackaged) {
  app.setPath("userData", path.join(app.getPath("appData"), `${PRODUCT_NAME} Dev`));
}
// Every renderer is sandboxed, including any created later.
app.enableSandbox();

// Chromium would route the game's audio to the system media controls: hardware media keys
// and the macOS "Now Playing" widget could then pause songs. The Tauri webview didn't.
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const logger = createLogger(logDir());

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

/** Applies the same CSP to pages from the Vite dev server, so problems show up in development. */
function applyDevelopmentCsp(url: string) {
  session.defaultSession.webRequest.onHeadersReceived({ urls: [`${url}/*`] }, (details, callback) => {
    if (details.resourceType !== "mainFrame") return callback({});
    callback({
      responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [CONTENT_SECURITY_POLICY] },
    });
  });
}

function createWindow(): BrowserWindow {
  const saved = loadWindowState(configDir());

  const window = new BrowserWindow({
    title: PRODUCT_NAME,
    // Tauri's defaults; the saved state usually replaces them.
    width: 800,
    height: 600,
    ...saved.bounds,
    useContentSize: true,
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      spellcheck: false,
      // The game clock runs on requestAnimationFrame and media time; don't let Chromium
      // throttle it when the window is occluded.
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: [`--tp-version=${app.getVersion()}`],
    },
  });

  if (saved.maximized) window.maximize();
  if (saved.fullscreen) window.setFullScreen(true);
  window.once("ready-to-show", () => window.show());
  window.on("close", () => saveWindowState(configDir(), window));

  // No pinch zoom; the webview didn't zoom either.
  void window.webContents.setVisualZoomLevelLimits(1, 1);

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
  native.setLogSink((record) => logger.write(record.level, record.target, record.message));
  setApplicationMenu();

  // Packaged apps get their icon from the bundle; in development the Dock would show Electron's.
  if (!app.isPackaged && process.platform === "darwin") {
    app.dock?.setIcon(path.join(__dirname, "../resources/icons/icon.png"));
  }

  const stores = new JsonStores(storeDir());
  const songFolders = new SongFolderAccess(stores);
  const songPaths = songPathArgs(process.argv);
  await songFolders.restore(songPaths ?? []);

  // The embed page on the media server may only be framed by the app itself.
  await native.startLocalServer([appOrigin]);

  // The only web permissions the game uses; everything else is denied, for requests and
  // for the synchronous checks behind APIs like navigator.permissions.
  const allowed = (url: string, permission: string) =>
    URL.parse(url)?.origin === appOrigin && (permission === "fullscreen" || permission === "screen-wake-lock");
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(allowed(contents.getURL(), permission));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    allowed(requestingOrigin, permission),
  );

  if (devServerUrl) applyDevelopmentCsp(appOrigin);
  else serveRenderer();

  const rpc = createRpcHandler({
    stores,
    songFolders,
    songPaths,
    log: (level, message) => logger.write(level.toUpperCase(), "webview", message),
  });
  listenForRpc(rpc, appOrigin, (id) => {
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

process.on("uncaughtException", (error) => logger.write("ERROR", "tuneperfect", error.stack ?? String(error)));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("window-all-closed", () => app.quit());
  app.whenReady().then(start, (error: unknown) => {
    logger.write("ERROR", "tuneperfect", `Failed to start: ${error instanceof Error ? error.stack : String(error)}`);
    app.exit(1);
  });
}
