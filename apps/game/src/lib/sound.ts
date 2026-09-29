import { Howl } from "howler";

import SoundComboBreak from "~/assets/sounds/combo-break.ogg?url";
import SoundComboMilestone from "~/assets/sounds/combo-milestone.ogg?url";
import SoundConfirm from "~/assets/sounds/confirm.mp3?url";
import SoundCountTick from "~/assets/sounds/count-tick.ogg?url";
import SoundGoldenHit from "~/assets/sounds/golden-hit.ogg?url";
import SoundPerfect from "~/assets/sounds/perfect.ogg?url";
import SoundSelect from "~/assets/sounds/select.mp3?url";
import SoundTierA from "~/assets/sounds/tier-a.mp3?url";
import SoundTierB from "~/assets/sounds/tier-b.mp3?url";
import SoundTierC from "~/assets/sounds/tier-c.mp3?url";
import SoundTierD from "~/assets/sounds/tier-d.mp3?url";
import SoundTierS from "~/assets/sounds/tier-s.mp3?url";
import SoundTierSPlus from "~/assets/sounds/tier-splus.mp3?url";
import SoundWhoosh from "~/assets/sounds/whoosh.ogg?url";
import { settingsStore, type VolumeSettings } from "~/stores/settings";

interface SoundDefinition {
  src: string;
  category: keyof Pick<VolumeSettings, "menu" | "effects">;
  // Per-sound gain so clips normalized to 0 dB sit at a sensible level.
  gain: number;
}

const sounds = {
  confirm: { src: SoundConfirm, category: "menu", gain: 1 },
  select: { src: SoundSelect, category: "menu", gain: 1 },
  // In-game sounds are short and quiet: the microphones also pick up the speakers.
  goldenHit: { src: SoundGoldenHit, category: "effects", gain: 0.4 },
  comboMilestone: { src: SoundComboMilestone, category: "effects", gain: 0.5 },
  comboBreak: { src: SoundComboBreak, category: "effects", gain: 0.3 },
  perfect: { src: SoundPerfect, category: "effects", gain: 0.5 },
  countTick: { src: SoundCountTick, category: "effects", gain: 0.4 },
  whoosh: { src: SoundWhoosh, category: "effects", gain: 0.5 },
  // Results screen (loudness-normalised, so one gain for all): recording has stopped, so these can be bigger.
  tierD: { src: SoundTierD, category: "effects", gain: 0.8 },
  tierC: { src: SoundTierC, category: "effects", gain: 0.8 },
  tierB: { src: SoundTierB, category: "effects", gain: 0.8 },
  tierA: { src: SoundTierA, category: "effects", gain: 0.8 },
  tierS: { src: SoundTierS, category: "effects", gain: 0.8 },
  tierSPlus: { src: SoundTierSPlus, category: "effects", gain: 0.8 },
} as const satisfies Record<string, SoundDefinition>;

export type SoundName = keyof typeof sounds;

const instances = new Map<SoundName, Howl>();

function getInstance(name: SoundName) {
  let instance = instances.get(name);
  if (!instance) {
    const definition = sounds[name];
    // Menu sounds stream through HTML5 audio as before; effects use Web Audio
    // for low latency and overlapping playback.
    instance = new Howl({ src: [definition.src], preload: true, html5: definition.category === "menu" });
    instances.set(name, instance);
  }

  return instance;
}

for (const name of Object.keys(sounds) as SoundName[]) {
  getInstance(name);
}

interface PlaySoundOptions {
  // Playback rate, e.g. to raise the pitch of consecutive stars.
  rate?: number;
  /** Extra volume factor, e.g. to keep several simultaneous sounds from adding up. */
  gain?: number;
}

export function playSound(name: SoundName, options: PlaySoundOptions = {}) {
  const definition = sounds[name];
  const volume = settingsStore.getVolume(definition.category) * definition.gain * (options.gain ?? 1);
  if (volume <= 0) {
    return;
  }

  const instance = getInstance(name);
  const id = instance.play();
  instance.volume(volume, id);
  if (options.rate !== undefined) {
    instance.rate(options.rate, id);
  }
}
