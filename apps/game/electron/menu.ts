import { app, Menu, type MenuItemConstructorOptions } from "electron";

/**
 * The application menu the Tauri version had: on macOS the standard app, File, Edit, View,
 * Window and Help menus (the Edit menu makes copy/paste work in text fields); on Windows
 * and Linux no menu bar. Unlike Electron's default menu there is no reload, zoom or
 * developer tools, except in development.
 */
export function setApplicationMenu() {
  const development = !app.isPackaged;
  const developmentItems: MenuItemConstructorOptions[] = development
    ? [{ type: "separator" }, { role: "reload" }, { role: "toggleDevTools" }]
    : [];

  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(
      development ? Menu.buildFromTemplate([{ label: "View", submenu: developmentItems.slice(1) }]) : null,
    );
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { label: "File", submenu: [{ role: "close" }] },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      { label: "View", submenu: [{ role: "togglefullscreen" }, ...developmentItems] },
      { role: "windowMenu" },
      { role: "help", submenu: [] },
    ]),
  );
}
