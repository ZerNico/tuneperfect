import fs from "node:fs";
import path from "node:path";

/** Rotate by starting over once the file grows past this, like Tauri's "keep one" strategy. */
const MAX_FILE_SIZE = 1_000_000;

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export interface Logger {
  write(level: LogLevel | string, target: string, message: string): void;
}

function timestamp(): string {
  // UTC, in the layout Tauri's log plugin used: [2026-09-28][13:52:10]
  const iso = new Date().toISOString();
  return `[${iso.slice(0, 10)}][${iso.slice(11, 19)}]`;
}

/**
 * Writes `[date][time][target][LEVEL] message` lines to `<dir>/Tune Perfect.log` and to the
 * console, the format and place the Tauri version used.
 */
export function createLogger(dir: string): Logger {
  const file = path.join(dir, "Tune Perfect.log");
  let size = 0;
  let available = true;

  try {
    fs.mkdirSync(dir, { recursive: true });
    size = fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0;
  } catch {
    available = false;
  }

  return {
    write(level, target, message) {
      const line = `${timestamp()}[${target}][${level}] ${message}\n`;
      (level === "ERROR" ? process.stderr : process.stdout).write(line);
      if (!available) return;

      try {
        if (size + line.length > MAX_FILE_SIZE) {
          fs.writeFileSync(file, line);
          size = line.length;
        } else {
          fs.appendFileSync(file, line);
          size += line.length;
        }
      } catch {
        // Logging must never take the app down.
      }
    },
  };
}
