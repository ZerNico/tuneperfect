import { createServerFn } from "@tanstack/solid-start";

export const config = createServerFn({ method: "GET" }).handler(async () => {
  return {
    VITE_APP_URL: process.env.VITE_APP_URL,
    // The release the download pages link to. DOWNLOAD_VERSION holds them on an older release
    // (the last Tauri one, until installs move to Electron); otherwise the deployed one.
    DOWNLOAD_VERSION: process.env.DOWNLOAD_VERSION || process.env.VERSION,
    GITHUB_REPO: process.env.GITHUB_REPO,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    VITE_POSTHOG_TOKEN: process.env.VITE_POSTHOG_TOKEN,
  };
});
