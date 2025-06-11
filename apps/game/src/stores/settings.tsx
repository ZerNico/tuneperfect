import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { tauriStorage } from "~/lib/utils/storage";

export const storage = tauriStorage("settings.json", { autoSave: true });

export interface Microphone {
  name: string;
  channel: number;
  color: string;
  delay: number;
  gain: number;
  threshold: number;
}

export interface VolumeSettings {
  master: number;
  game: number;
  preview: number;
  menu: number;
}

export interface GeneralSettings {
  language: string;
  forceOfflineMode: boolean;
}

function createSettingsStore() {
  const [initialized, setInitialized] = createSignal(false);
  const [microphones, setMicrophones] = makePersisted(createSignal<Microphone[]>([]), {
    name: "microphones",
    storage,
  });
  const [volume, setVolume] = makePersisted(
    createSignal<VolumeSettings>({
      master: 1,
      game: 1,
      preview: 0.5,
      menu: 0.5,
    }),
    {
      name: "volume",
      storage,
    }
  );
  const [general, setGeneral] = makePersisted(
    createSignal<GeneralSettings>({
      language: "en",
      forceOfflineMode: false,
    }),
    {
      name: "general",
      storage,
    }
  );

  const saveMicrophone = (index: number, microphone: Microphone) => {
    setMicrophones((prev) => {
      const next = [...prev];
      next[index] = microphone;
      return next;
    });
  };

  const deleteMicrophone = (index: number) => {
    setMicrophones((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const saveVolume = (settings: VolumeSettings) => {
    setVolume(settings);
  };

  const getVolume = (key: keyof VolumeSettings) => {
    return volume()[key] * volume().master;
  };

  const saveGeneral = (settings: GeneralSettings) => {
    setGeneral(settings);
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
