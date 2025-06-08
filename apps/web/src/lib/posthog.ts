import posthog from "posthog-js";

export const initPostHog = (token: string) => {
  posthog.init(token, {
    api_host: "https://eu.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "memory",
    defaults: "2025-05-24",
  });
};

export { posthog };
