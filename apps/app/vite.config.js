import importMetaEnv from "@import-meta-env/unplugin";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "solid", autoCodeSplitting: true }),
    solidPlugin(),
    tailwindcss(),
    icons({ compiler: "solid" }),
    importMetaEnv.vite({
      example: ".env.example",
      env: ".env",
    }),
  ],
  server: {
    port: 3001,
  },
  resolve: { alias: { "~": "/src" } },
});
