import { PostHog } from "posthog-node";

import { env } from "../config/env";

export const posthog = env.POSTHOG_TOKEN
  ? new PostHog(env.POSTHOG_TOKEN, {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 10_000,
    })
  : null;

export const captureException = (error: unknown, distinctId: string | undefined, extra?: Record<string, unknown>) => {
  if (!posthog) return;
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err, distinctId ?? "anonymous", {
    app_name: "api",
    ...extra,
  });
};
