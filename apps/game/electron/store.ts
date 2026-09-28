import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/** Store files are flat names like `settings.json` or `settings_backup_<timestamp>.json`. */
const STORE_FILE = /^[\w.-]+\.json$/;

const WRITE_DELAY_MS = 100;

type StoreData = Record<string, unknown>;

/**
 * JSON files in the app's data directory, one object each. Reads are served from memory
 * after the first load; writes are debounced, written atomically and flushed on quit.
 */
export class JsonStores {
  readonly #dir: string;
  readonly #cache = new Map<string, StoreData | null>();
  readonly #pendingWrites = new Map<string, NodeJS.Timeout>();

  constructor(dir: string) {
    this.#dir = dir;
  }

  /** The file's object, or `null` if it doesn't exist or doesn't hold a JSON object. */
  async read(file: string): Promise<StoreData | null> {
    const filePath = this.#path(file);
    if (this.#cache.has(file)) return this.#cache.get(file) ?? null;

    let data: StoreData | null = null;
    try {
      const parsed: unknown = JSON.parse(await fsp.readFile(filePath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as StoreData;
    } catch {
      // Missing or unreadable: the caller falls back to its defaults.
    }
    // A write that happened while reading wins.
    if (!this.#cache.has(file)) this.#cache.set(file, data);
    return this.#cache.get(file) ?? null;
  }

  write(file: string, data: StoreData): void {
    this.#path(file);
    this.#cache.set(file, data);

    const pending = this.#pendingWrites.get(file);
    if (pending) clearTimeout(pending);
    this.#pendingWrites.set(
      file,
      setTimeout(() => {
        this.#pendingWrites.delete(file);
        this.#writeFile(file, data).catch((error: unknown) => console.error(`Failed to write store ${file}:`, error));
      }, WRITE_DELAY_MS),
    );
  }

  /** Writes every file with unsaved changes. Synchronous so it can run while quitting. */
  flushSync(): void {
    for (const [file, timer] of this.#pendingWrites) {
      clearTimeout(timer);
      const data = this.#cache.get(file);
      if (!data) continue;
      const filePath = this.#path(file);
      fs.mkdirSync(this.#dir, { recursive: true });
      fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(data, null, 2));
      fs.renameSync(`${filePath}.tmp`, filePath);
    }
    this.#pendingWrites.clear();
  }

  #path(file: string): string {
    if (!STORE_FILE.test(file)) throw new Error(`Invalid store file name: ${file}`);
    return path.join(this.#dir, file);
  }

  async #writeFile(file: string, data: StoreData): Promise<void> {
    const filePath = this.#path(file);
    await fsp.mkdir(this.#dir, { recursive: true });
    await fsp.writeFile(`${filePath}.tmp`, JSON.stringify(data, null, 2));
    await fsp.rename(`${filePath}.tmp`, filePath);
  }
}
