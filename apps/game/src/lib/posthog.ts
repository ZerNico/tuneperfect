import { getVersion } from "@tauri-apps/api/app";
import posthog from "posthog-js";

export const initPostHog = async (token: string) => {
  posthog.init(token, {
    api_host: "https://eu.i.posthog.com",
    defaults: "2025-05-24",
    cookieless_mode: "always",
    persistence: "memory",
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    mask_personal_data_properties: true,
  });

  const appVersion = await getVersion().catch(() => undefined);
  posthog.register({ app_name: "game", app_version: appVersion });
};

export { posthog };
