import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "./logger";

describe("createLogger", () => {
  let dir: string;
  const file = () => path.join(dir, "Tune Perfect.log");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tp-logger-"));
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("appends formatted lines in order", async () => {
    const logger = createLogger(dir);
    for (let i = 0; i < 500; i++) logger.write("INFO", "test", `line ${i}`);
    await logger.flush();

    const lines = fs.readFileSync(file(), "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(500);
    expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}\]\[\d{2}:\d{2}:\d{2}\]\[test\]\[INFO\] line 0$/);
    expect(lines.at(-1)).toMatch(/line 499$/);
  });

  it("keeps existing content across restarts", async () => {
    const first = createLogger(dir);
    first.write("INFO", "test", "before");
    await first.flush();

    const second = createLogger(dir);
    second.write("WARN", "test", "after");
    await second.flush();

    expect(fs.readFileSync(file(), "utf8")).toMatch(/before\n.*after\n$/);
  });

  it("moves a full log to .old and starts a new one", async () => {
    const logger = createLogger(dir, 200);
    for (let i = 0; i < 10; i++) logger.write("INFO", "test", `line ${i}`);
    await logger.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const current = fs.readFileSync(file(), "utf8");
    const old = fs.readFileSync(`${file()}.old`, "utf8");
    expect(current.length).toBeLessThanOrEqual(200);
    expect(current).toMatch(/line 9\n$/);
    // Every line ends up in exactly one of the two files.
    const all = (old + current).trimEnd().split("\n");
    expect(new Set(all.map((line) => line.replace(/.*\] /, ""))).size).toBe(all.length);
  });

  it("keeps working when the directory can't be created", async () => {
    const blocked = path.join(dir, "not-a-dir");
    fs.writeFileSync(blocked, "");
    const logger = createLogger(path.join(blocked, "logs"));
    expect(() => logger.write("ERROR", "test", "still printed")).not.toThrow();
    await logger.flush();
  });
});
