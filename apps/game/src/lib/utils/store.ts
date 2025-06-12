import { load } from "@tauri-apps/plugin-store";
import { createEffect, createSignal, on } from "solid-js";
import * as v from "valibot";
import { makeNested } from "./setter";

export interface PersistentStoreOptions<T> {
  filename: string;
  schema: v.GenericSchema<T>;
  defaults: T;
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

      const loadedSettings = result.success ? result.output : defaults;

      setSettings(loadedSettings);
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
