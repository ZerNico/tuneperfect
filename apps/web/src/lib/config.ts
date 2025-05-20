import { createServerFn } from "@tanstack/solid-start";

export const config = createServerFn({ method: "GET" }).handler(async () => {
  return {
    VITE_APP_URL: process.env.VITE_APP_URL,
  };
});
