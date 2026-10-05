import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { nitro } from "nitro/vite";
import icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import viteSolid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({ preset: "bun" }),
    viteSolid({ ssr: true }),
    icons({
      compiler: "solid",
    }),

    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
