/**
 * The app's name and identifiers, shared by the main process and the packaging script.
 * Electron itself only knows the name (`app.getName()`); the identifier is a packaging
 * concept (bundle ID on macOS, AppUserModelId on Windows). The data, config and log
 * directories are named after it, as they were in the Tauri version.
 */
export const PRODUCT_NAME = "Tune Perfect";

/** Identifier of release builds. */
export const APP_ID = "org.tuneperfect.game";

/** Identifier of development builds, so they keep their own settings and logs. */
export const DEV_APP_ID = "localhost.tuneperfect.game";
