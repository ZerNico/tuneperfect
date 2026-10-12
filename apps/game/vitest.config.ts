import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Solid's build for Node is the SSR one, where effects never run. Tests get the browser
  // build, inlined so Node's own resolution doesn't pick the SSR one again.
  ssr: { resolve: { conditions: ["browser"], externalConditions: ["browser"] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "electron/**/*.test.ts"],
    server: { deps: { inline: [/solid-js/, /@solid-primitives/] } },
  },
});
