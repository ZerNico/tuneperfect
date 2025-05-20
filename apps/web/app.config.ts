import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@tanstack/solid-start/config";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import icons from "unplugin-icons/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  tsr: {
    appDirectory: "src",
  },
  server: {
    preset: "bun",
  },
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      icons({
        customCollections: {
          sing: FileSystemIconLoader("./src/assets/icons"),
        },
        compiler: "solid",
      }),
    ],
  },
});
