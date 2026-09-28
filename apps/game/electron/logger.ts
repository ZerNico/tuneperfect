import fs from "node:fs";
import path from "node:path";

import { PRODUCT_NAME } from "./identity";

/** Once the log grows past this, it moves to `<name>.log.old` and a new one starts. */
const MAX_FILE_SIZE = 1_000_000;

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export interface Logger {
  write(level: LogLevel | string, target: string, message: string): void;
  /** Resolves once everything written so far has reached the file. */
  flush(): Promise<void>;
}

function timestamp(): string {
  // UTC: [2026-09-28][13:52:10]
  const iso = new Date().toISOString();
  return `[${iso.slice(0, 10)}][${iso.slice(11, 19)}]`;
}

/**
 * Writes `[date][time][target][LEVEL] message` lines to `<dir>/<product name>.log` and to the
 * console. Writes go through a stream, so logging never blocks the main process.
 */
export function createLogger(dir: string, maxFileSize = MAX_FILE_SIZE): Logger {
  const file = path.join(dir, `${PRODUCT_NAME}.log`);
  let stream: fs.WriteStream | null = null;
  let size = 0;

  const open = () => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Opened synchronously so the file exists right away (rotation renames it); the
      // writes themselves are asynchronous.
      const fd = fs.openSync(file, "a");
      size = fs.fstatSync(fd).size;
      const opened = fs.createWriteStream(file, { fd });
      // Logging must never take the app down; without a file, lines still reach the console.
      opened.on("error", () => {
        if (stream === opened) stream = null;
      });
      stream = opened;
    } catch {
      stream = null;
    }
  };

  open();

  return {
    write(level, target, message) {
      const line = `${timestamp()}[${target}][${level}] ${message}\n`;
      (level === "ERROR" ? process.stderr : process.stdout).write(line);
      if (!stream) return;

      const length = Buffer.byteLength(line);
      if (size + length > maxFileSize) {
        // The old stream keeps writing whatever it still buffers to the renamed file.
        stream.end();
        try {
          fs.renameSync(file, `${file}.old`);
        } catch {
          // Rotation is best effort.
        }
        open();
        if (!stream) return;
      }

      stream.write(line);
      size += length;
    },

    flush() {
      const current = stream;
      if (!current) return Promise.resolve();
      return new Promise((resolve) => current.write("", () => resolve()));
    },
  };
}
