import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { nitro } from "nitro/vite";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import viteSolid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({ preset: "bun" }),
    viteSolid({ ssr: true }),
    icons({
      customCollections: {
        sing: FileSystemIconLoader("./src/assets/icons"),
      },
      compiler: "solid",
    }),

    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
