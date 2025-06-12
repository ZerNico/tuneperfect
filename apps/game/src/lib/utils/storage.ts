import type { AsyncStorage } from "@solid-primitives/storage";
import { load, type StoreOptions } from "@tauri-apps/plugin-store";

export function tauriStorage(name: string, options?: StoreOptions): AsyncStorage {
  const store = load(name, options);

  return {
    getItem: async (key) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return (await (await store).get(key)) ?? null;
    },
    setItem: async (key, value) => {
      await (await store).set(key, value);
    },
    removeItem: async (key) => {
      await (await store).delete(key);
    },
    keys: async () => {
      return (await store).keys();
    },
    clear: async () => {
      await (await store).clear();
    },
  };
}
