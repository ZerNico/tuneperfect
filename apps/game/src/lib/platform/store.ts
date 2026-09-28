import { native } from "~/lib/native/client";

/** A JSON key-value file in the app's data directory, persisted by the main process. */
export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  entries<T = unknown>(): Promise<[string, T][]>;
  save(): Promise<void>;
}

export async function load(file: string): Promise<Store> {
  return {
    get: async <T>(key: string) => (await native.store.get({ file, key })) as T | undefined,
    set: async (key, value) => {
      await native.store.set({ file, key, value });
    },
    delete: (key) => native.store.delete({ file, key }),
    entries: async <T>() => (await native.store.entries({ file })) as [string, T][],
    save: async () => {
      await native.store.save({ file });
    },
  };
}
