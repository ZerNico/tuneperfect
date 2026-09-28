import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/** Store files are flat names like `settings.json` or `settings_backup_<timestamp>.json`. */
const STORE_FILE = /^[\w.-]+\.json$/;

const WRITE_DELAY_MS = 100;

/**
 * JSON key-value files, one object per file, compatible with what Tauri's store plugin
 * wrote. The main process owns the data: reads come from memory after the first load and
 * writes are debounced, written atomically, and flushed on quit.
 */
export class JsonStores {
  readonly #dir: string;
  readonly #data = new Map<string, Promise<Record<string, unknown>>>();
  /** The same objects once loaded, so a flush at quit can write without awaiting. */
  readonly #loaded = new Map<string, Record<string, unknown>>();
  readonly #pendingWrites = new Map<string, NodeJS.Timeout>();

  constructor(dir: string) {
    this.#dir = dir;
  }

  async entries(file: string): Promise<[string, unknown][]> {
    return Object.entries(await this.#load(file));
  }

  async get(file: string, key: string): Promise<unknown> {
    return (await this.#load(file))[key];
  }

  async set(file: string, key: string, value: unknown): Promise<void> {
    const data = await this.#load(file);
    data[key] = value;
    this.#scheduleWrite(file);
  }

  async delete(file: string, key: string): Promise<boolean> {
    const data = await this.#load(file);
    if (!(key in data)) return false;
    delete data[key];
    this.#scheduleWrite(file);
    return true;
  }

  async save(file: string): Promise<void> {
    const pending = this.#pendingWrites.get(file);
    if (pending) clearTimeout(pending);
    this.#pendingWrites.delete(file);
    await this.#write(file);
  }

  /** Writes every file with unsaved changes. Synchronous so it can run while quitting. */
  flushSync(): void {
    for (const [file, timer] of this.#pendingWrites) {
      clearTimeout(timer);
      // A write is only ever scheduled after the file finished loading.
      const data = this.#loaded.get(file);
      if (data) this.#writeSync(file, data);
    }
    this.#pendingWrites.clear();
  }

  #path(file: string): string {
    if (!STORE_FILE.test(file)) throw new Error(`Invalid store file name: ${file}`);
    return path.join(this.#dir, file);
  }

  #load(file: string): Promise<Record<string, unknown>> {
    let data = this.#data.get(file);
    if (!data) {
      const filePath = this.#path(file);
      data = fsp
        .readFile(filePath, "utf8")
        .then(
          (contents): Record<string, unknown> => {
            const parsed: unknown = JSON.parse(contents);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : {};
          },
          () => ({}),
        )
        .then((value) => {
          this.#loaded.set(file, value);
          return value;
        });
      this.#data.set(file, data);
    }
    return data;
  }

  #scheduleWrite(file: string): void {
    const pending = this.#pendingWrites.get(file);
    if (pending) clearTimeout(pending);
    this.#pendingWrites.set(
      file,
      setTimeout(() => {
        this.#pendingWrites.delete(file);
        this.#write(file).catch((error: unknown) => console.error(`Failed to write store ${file}:`, error));
      }, WRITE_DELAY_MS),
    );
  }

  async #write(file: string): Promise<void> {
    const data = await this.#load(file);
    const filePath = this.#path(file);
    await fsp.mkdir(this.#dir, { recursive: true });
    const temp = `${filePath}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(data, null, 2));
    await fsp.rename(temp, filePath);
  }

  #writeSync(file: string, data: Record<string, unknown>): void {
    const filePath = this.#path(file);
    fs.mkdirSync(this.#dir, { recursive: true });
    const temp = `${filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, filePath);
  }
}
