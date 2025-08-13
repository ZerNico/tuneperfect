import { load } from "@tauri-apps/plugin-store";
import { createEffect, createSignal, on } from "solid-js";
import * as v from "valibot";
import { makeNested } from "./setter";

export interface PersistentStoreOptions<T> {
  filename: string;
  schema: v.GenericSchema<unknown, T>;
  defaults: T;
}

/**
 * Creates a backup store with a timestamp when parsing fails
 */
async function createBackupStore(filename: string, entries: [string, unknown][]): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split(".")[0];
  const fileExtension = filename.includes(".") ? `.${filename.split(".").pop()}` : "";
  const nameWithoutExtension = filename.includes(".") ? filename.substring(0, filename.lastIndexOf(".")) : filename;
  const backupFilename = `${nameWithoutExtension}_backup_${timestamp}${fileExtension}`;

  const backupStore = await load(backupFilename);

  for (const [key, value] of entries) {
    await backupStore.set(key, value);
  }

  console.warn(`Settings backup created: ${backupFilename}`);
}

export function createPersistentStore<T>(options: PersistentStoreOptions<T>) {
  const { filename, schema, defaults } = options;

  const [settings, setSettings, updateSettings] = makeNested(createSignal<T>(defaults));
  const [initialized, setInitialized] = createSignal(false);

  async function initialize() {
    try {
      const store = await load(filename);
      const entries = await store.entries();
      const object = Object.fromEntries(entries);
      const result = v.safeParse(schema, object);

      if (result.success) {
        setSettings(result.output);
      } else {
        if (entries.length > 0) {
          try {
            await createBackupStore(filename, entries);
          } catch (backupError) {
            console.error("Failed to create backup during parse failure:", backupError);
          }
        }

        setSettings(defaults);
      }

      setInitialized(true);
    } catch {
      setSettings(defaults);
      setInitialized(true);
    }
  }

  createEffect(
    on(
      settings,
      async (currentSettings) => {
        if (!initialized()) return;

        try {
          const store = await load(filename);

          for (const [key, value] of Object.entries(currentSettings as Record<string, unknown>)) {
            await store.set(key, value);
          }
        } catch {}
      },
      { defer: true },
    ),
  );

  return {
    settings,
    setSettings,
    updateSettings,
    initialize,
    initialized,
  };
}
