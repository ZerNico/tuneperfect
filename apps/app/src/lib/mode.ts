export type Mode = "lobby" | "sing" | "party" | "settings";

/** The game's mode colours per section: lobby, songs (sing), clubs (party), account (settings). */
export function modeForPath(pathname: string): Mode {
  if (pathname === "/songs") return "sing";
  if (pathname === "/" || pathname === "/controller" || pathname.startsWith("/join")) return "lobby";
  if (pathname.startsWith("/clubs")) return "party";
  return "settings";
}

/**
 * Sets the section on <html> (read by styles.css for --accent-from/--accent-to). On <html> rather than
 * the app root because dialogs, menus and toasts are portalled outside it but use the colours too.
 */
export function applyMode(pathname: string) {
  const mode = modeForPath(pathname);
  if (document.documentElement.dataset.mode !== mode) document.documentElement.dataset.mode = mode;
}
