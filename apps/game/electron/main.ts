import path from "node:path";

import { app, BrowserWindow, session, shell, webContents } from "electron";

import { CONTENT_SECURITY_POLICY } from "./csp";
import { PRODUCT_NAME } from "./identity";
import { createLogger } from "./logger";
import { attachContextMenu, setApplicationMenu } from "./menu";
import { native } from "./native";
import { handleMediaProtocol } from "./protocols/media";
import { handleRendererProtocol } from "./protocols/renderer";
import { APP_ORIGIN, originOf, registerSchemes } from "./protocols/schemes";
import { createRpcHandler, listenForRpc } from "./rpc";
import { grantSongFolders } from "./song-folders";
import { JsonStores } from "./store";
import { cleanUpAfterTauri, migrateFromTauri } from "./tauri-migration";
import { loadWindowState, saveWindowState } from "./window-state";
import { startYoutubeEmbedServer } from "./youtube-embed/server";

/** Set by the dev script; packaged and preview builds load the bundled frontend instead. */
const devServerUrl = process.env.TUNEPERFECT_DEV_SERVER_URL;

const appUrl = devServerUrl ?? `${APP_ORIGIN}/`;
const appOrigin = devServerUrl ? new URL(devServerUrl).origin : APP_ORIGIN;

const rendererDir = path.join(__dirname, "../dist");

// Electron names the data and log directories after the app, so development builds get
// their own and never share settings, storage or the single-instance lock with a release.
app.setName(app.isPackaged ? PRODUCT_NAME : `${PRODUCT_NAME} Dev`);
// Every renderer is sandboxed, including any created later.
app.enableSandbox();

// Chromium would route the game's audio to the system media controls: hardware media keys
// and the macOS "Now Playing" widget could then pause songs. The Tauri webview didn't.
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");

registerSchemes();

const logger = createLogger(app.getPath("logs"));

/** Stores and window state. `TUNEPERFECT_STORE_DIR` points it elsewhere, e.g. at a copy. */
const dataDir = process.env.TUNEPERFECT_STORE_DIR ?? app.getPath("userData");

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
  const saved = loadWindowState(dataDir);

  const window = new BrowserWindow({
    title: PRODUCT_NAME,
    // First launch; afterwards the saved state replaces these.
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
  window.on("close", () => saveWindowState(dataDir, window));

  attachContextMenu(window.webContents);

  // No pinch zoom; the webview didn't zoom either.
  void window.webContents.setVisualZoomLevelLimits(1, 1);

  // Links to other sites open in the browser; the app window never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (originOf(url) !== appOrigin) event.preventDefault();
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

  migrateFromTauri(dataDir, logger);
  cleanUpAfterTauri(logger);
  const stores = new JsonStores(dataDir);
  const songPaths = songPathArgs(process.argv);
  await grantSongFolders(stores, songPaths ?? []);

  // Without it YouTube songs can't play, but everything else still works.
  const youtubeEmbed = await startYoutubeEmbedServer([appOrigin]).catch((error: unknown) => {
    logger.write("ERROR", "tuneperfect", `YouTube embed server failed to start: ${String(error)}`);
    return null;
  });

  // The only web permissions the game uses; everything else is denied, for requests and
  // for the synchronous checks behind APIs like navigator.permissions. Writing the clipboard
  // (copying error details) is allowed, reading it isn't.
  const permissions = new Set(["fullscreen", "screen-wake-lock", "clipboard-sanitized-write"]);
  const allowed = (url: string, permission: string) => originOf(url) === appOrigin && permissions.has(permission);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(allowed(contents.getURL(), permission));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    allowed(requestingOrigin, permission),
  );

  if (devServerUrl) applyDevelopmentCsp(appOrigin);
  else handleRendererProtocol(rendererDir, CONTENT_SECURITY_POLICY);
  handleMediaProtocol(appOrigin);

  const rpc = createRpcHandler({
    stores,
    songPaths,
    youtubePlayerUrl: youtubeEmbed?.playerUrl ?? null,
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
    // Stop capture before the addon is torn down with the process, and let the log catch up.
    quitting = true;
    event.preventDefault();
    void native
      .stopRecording()
      .catch(() => {})
      .then(() => logger.flush())
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
