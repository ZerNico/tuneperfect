import { createEffect, createRoot, createSignal, on } from "solid-js";
import * as v from "valibot";

import { native } from "~/lib/native/client";

import { makeNested } from "./setter";

export interface PersistentStoreOptions<T> {
  filename: string;
  schema: v.GenericSchema<unknown, T>;
  defaults: T;
}

/**
 * Creates a backup store with a timestamp when parsing fails
 */
async function createBackupStore(filename: string, data: Record<string, unknown>): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split(".")[0];
  const fileExtension = filename.includes(".") ? `.${filename.split(".").pop()}` : "";
  const nameWithoutExtension = filename.includes(".") ? filename.substring(0, filename.lastIndexOf(".")) : filename;
  const backupFilename = `${nameWithoutExtension}_backup_${timestamp}${fileExtension}`;

  await native.store.write({ file: backupFilename, data });

  console.warn(`Settings backup created: ${backupFilename}`);
}

export function createPersistentStore<T>(options: PersistentStoreOptions<T>) {
  const { filename, schema, defaults } = options;

  // oxlint-disable-next-line solid/reactivity
  const settingsSignal = createSignal<T>(defaults);
  const [settings, setSettings, updateSettings] = makeNested(settingsSignal);
  const [initialized, setInitialized] = createSignal(false);

  async function initialize() {
    try {
      const data = await native.store.read({ file: filename });
      const result = v.safeParse(schema, data ?? {});

      if (result.success) {
        setSettings(result.output);
      } else {
        if (data && Object.keys(data).length > 0) {
          try {
            await createBackupStore(filename, data);
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

  createRoot(() => {
    createEffect(
      on(
        settings,
        async (currentSettings) => {
          if (!initialized()) return;

          try {
            await native.store.write({ file: filename, data: currentSettings as Record<string, unknown> });
          } catch {}
        },
        { defer: true },
      ),
    );
  });

  return {
    settings,
    setSettings,
    updateSettings,
    initialize,
    initialized,
  };
}
