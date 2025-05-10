import { Howl } from "howler";
import SoundConfirm from "~/assets/sounds/confirm.mp3?url";
import SoundSelect from "~/assets/sounds/select.mp3?url";
import { settingsStore } from "~/stores/settings";

const soundInstances = {
  confirm: new Howl({ src: [SoundConfirm], preload: true, html5: true }),
  select: new Howl({ src: [SoundSelect], preload: true, html5: true }),
} as const;

export function playSound(name: keyof typeof soundInstances) {
  const sound = soundInstances[name];

  sound.volume(settingsStore.getVolume("menu"));
  sound.play();
}
