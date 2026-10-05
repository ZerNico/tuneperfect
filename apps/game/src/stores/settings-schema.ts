import * as v from "valibot";

const microphoneSchema = v.object({
  // Stable device ID (cpal `DeviceId`). Optional so configs saved before ID
  // support remain valid; the backend falls back to matching by `name`.
  deviceId: v.optional(v.string()),
  name: v.string(),
  channel: v.fallback(v.number(), 0),
  color: v.fallback(v.string(), "sky"),
  delay: v.fallback(v.number(), 0),
  gain: v.fallback(v.number(), 1),
  threshold: v.fallback(v.number(), 1),
});

/** Keeps the valid entries of a list: one broken entry mustn't throw away the others. */
const validItems = <T extends v.GenericSchema>(item: T) =>
  v.pipe(
    v.fallback(v.array(v.unknown()), []),
    v.transform((items) =>
      items.flatMap((entry) => {
        const result = v.safeParse(item, entry);
        return result.success ? [result.output as v.InferOutput<T>] : [];
      }),
    ),
  );

/** An object whose fields all have fallbacks; a missing or broken object becomes all defaults. */
const section = <T extends v.ObjectEntries>(entries: T) => {
  const schema = v.object(entries);
  return v.fallback(schema, () => v.parse(schema, {}));
};

// Every field falls back on its own: a missing or broken value (an older or newer version, a hand
// edit) resets just that value, not the whole file with the microphones and song folders.
export const settingsStoreSchema = v.object({
  version: v.fallback(v.literal("1.0.0"), "1.0.0"),
  general: section({
    language: v.fallback(v.string(), "en"),
    forceOfflineMode: v.fallback(v.boolean(), false),
    showNoteSegments: v.fallback(v.boolean(), false),
    difficulty: v.fallback(v.picklist(["easy", "medium", "hard"]), "easy"),
    audioMode: v.fallback(v.picklist(["normal", "preferInstrumental"]), "normal"),
    micPlaybackEnabled: v.fallback(v.boolean(), false),
    songSelectStyle: v.fallback(v.picklist(["coverflow", "grid"]), "coverflow"),
    outputLatency: v.fallback(v.number(), 0),
    visualEffects: v.fallback(v.picklist(["full", "reduced"]), "full"),
  }),
  volume: section({
    master: v.fallback(v.number(), 1),
    game: v.fallback(v.number(), 1),
    preview: v.fallback(v.number(), 0.5),
    menu: v.fallback(v.number(), 0.5),
    micPlayback: v.fallback(v.number(), 1),
    effects: v.fallback(v.number(), 0.5),
  }),
  microphones: validItems(microphoneSchema),
  songs: section({
    paths: validItems(v.string()),
  }),
});

export type SettingsStore = v.InferOutput<typeof settingsStoreSchema>;
