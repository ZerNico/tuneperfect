import { desktop } from "./desktop";

export type Platform = "macos" | "windows" | "linux";

export function platform(): Platform {
  switch (desktop.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}
