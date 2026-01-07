#!/usr/bin/env bun

import { exists, mkdir } from "node:fs/promises";
import { helpPlugin } from "@clerc/plugin-help";
import { $ } from "bun";
import { Clerc } from "clerc";

async function ensureCerts() {
  const certFile = ".tmp/certs/tuneperfect.localhost.pem";
  const keyFile = ".tmp/certs/tuneperfect.localhost-key.pem";

  if ((await exists(certFile)) && (await exists(keyFile))) {
    return;
  }

  try {
    await mkdir(".tmp/certs", { recursive: true });
    await $`mkcert -key-file ${keyFile} -cert-file ${certFile} "tuneperfect.localhost" "api.tuneperfect.localhost" "app.tuneperfect.localhost"`;
  } catch (error) {
    console.error(`❌ Failed to generate certificates: ${error instanceof Error ? error.message : String(error)}`);
  }
}
Clerc.create()
  .use(helpPlugin())
  .scriptName("tuneperfect")
  .description("TunePerfect CLI tool")
  .version("1.0.0")
  .command("dev", "Start development environment", {
    flags: {
      filter: {
        type: [String],
        description: "Filter the apps to start",
      },
    },
  })
  .on("dev", async ({ flags }) => {
    await ensureCerts();

    const filter = flags.filter.flatMap((f) => ["--filter", `@tuneperfect/${f}`]);

    const processes = [
      Bun.spawn(["caddy", "run"], { stderr: "inherit", stdout: "inherit" }),
      Bun.spawn(["bun", "--bun", "run", "dev", ...filter], { stderr: "inherit", stdout: "inherit" }),
    ]

    process.on("SIGINT", () => {
      processes.forEach((process) => {
        process.kill("SIGINT");
      });
      process.exit(0);
    });

    await Promise.all(processes);
  })
  .parse();
