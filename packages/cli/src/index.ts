#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { helpPlugin } from "@clerc/plugin-help";
import { $ } from "bun";
import { Clerc } from "clerc";

Clerc.create()
  .use(helpPlugin())
  .scriptName("tuneperfect")
  .description("TunePerfect CLI tool")
  .version("1.0.0")
  .command("generate-certs", "setup dev environment", {
    flags: {
      force: {
        type: Boolean,
        description: "force setup",
      },
    },
  })
  .on("generate-certs", async () => {
    console.log("🔒 Generating certificates...");

    await mkdir(".tmp/certs", { recursive: true });
    await $`mkcert -cert-file .tmp/certs/tuneperfect.localhost.pem -key-file .tmp/certs/tuneperfect.localhost-key.pem tuneperfect.localhost app.tuneperfect.localhost api.tuneperfect.localhost`;
  })
  .parse();
