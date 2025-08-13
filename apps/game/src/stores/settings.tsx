import { createSignal } from "solid-js";
import * as v from "valibot";
import { createPersistentStore } from "../lib/utils/store";

const settingsStoreSchema = v.object({
  version: v.literal("1.0.0"),
  general: v.object({
    language: v.string(),
    forceOfflineMode: v.boolean(),
    showNoteSegments: v.fallback(v.boolean(), false),
    difficulty: v.fallback(v.picklist(["easy", "medium", "hard"]), "easy"),
  }),
  volume: v.object({
    master: v.number(),
    game: v.number(),
    preview: v.number(),
    menu: v.number(),
  }),
  microphones: v.array(
    v.object({
      name: v.string(),
      channel: v.number(),
      color: v.string(),
      delay: v.number(),
      gain: v.number(),
      threshold: v.number(),
    })
  ),
  songs: v.object({
    paths: v.array(v.string()),
  }),
});

export type SettingsStore = v.InferOutput<typeof settingsStoreSchema>;

const defaultSettings: SettingsStore = {
  version: "1.0.0",
  general: {
    language: "en",
    forceOfflineMode: false,
    showNoteSegments: false,
    difficulty: "easy",
  },
  volume: {
    master: 1,
    game: 1,
    preview: 0.5,
    menu: 0.5,
  },
  microphones: [],
  songs: {
    paths: [],
  },
};

const settingsStoreInstance = createPersistentStore({
  filename: "settings.json",
  schema: settingsStoreSchema,
  defaults: defaultSettings,
});

export const settings = settingsStoreInstance.settings;
export const setSettings = settingsStoreInstance.setSettings;
export const updateSettings = settingsStoreInstance.updateSettings;
export const initializeSettings = settingsStoreInstance.initialize;

export type Microphone = SettingsStore["microphones"][number];
export type VolumeSettings = SettingsStore["volume"];
export type GeneralSettings = SettingsStore["general"];

function createSettingsStore() {
  const [initialized, setInitialized] = createSignal(false);

  const volume = () => settings().volume;
  const microphones = () => settings().microphones;
  const general = () => settings().general;

  const saveMicrophone = (index: number, microphone: Microphone) => {
    updateSettings("microphones", (prev) => {
      const next = [...prev];
      next[index] = microphone;
      return next;
    });
  };

  const deleteMicrophone = (index: number) => {
    updateSettings("microphones", (prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const saveVolume = (settings: VolumeSettings) => {
    updateSettings("volume", settings);
  };

  const getVolume = (key: keyof VolumeSettings) => {
    return volume()[key] * volume().master;
  };

  const saveGeneral = (settings: GeneralSettings) => {
    updateSettings("general", settings);
  };

  return {
    initialized,
    setInitialized,
    microphones,
    saveMicrophone,
    deleteMicrophone,
    volume,
    saveVolume,
    getVolume,
    general,
    saveGeneral,
  };
}

export const settingsStore = createSettingsStore();
