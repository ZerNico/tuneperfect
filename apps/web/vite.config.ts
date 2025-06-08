import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    icons({
      customCollections: {
        sing: FileSystemIconLoader("./src/assets/icons"),
      },
      compiler: "solid",
    }),
    tanstackStart(),
  ],
});
