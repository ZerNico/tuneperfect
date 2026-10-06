import { createPersistentStore } from "../lib/utils/store";
import { type SettingsStore, settingsStoreSchema } from "./settings-schema";

export type { SettingsStore } from "./settings-schema";

const defaultSettings: SettingsStore = {
  version: "1.0.0",
  general: {
    language: "en",
    forceOfflineMode: false,
    showNoteSegments: false,
    difficulty: "easy",
    audioMode: "normal",
    micPlaybackEnabled: false,
    songSelectStyle: "coverflow",
    outputLatency: 0,
    visualEffects: "full",
  },
  volume: {
    master: 1,
    game: 1,
    preview: 0.5,
    menu: 0.5,
    micPlayback: 1,
    effects: 0.5,
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
