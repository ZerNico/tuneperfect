import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { settingsStoreSchema } from "./settings-schema";

const mic = { name: "Mic", channel: 1, color: "red", delay: 120, gain: 2, threshold: 3 };

describe("settingsStoreSchema", () => {
  it("fills a missing file with defaults", () => {
    const result = v.parse(settingsStoreSchema, {});
    expect(result.general.language).toBe("en");
    expect(result.volume.preview).toBe(0.5);
    expect(result.microphones).toEqual([]);
    expect(result.songs.paths).toEqual([]);
  });

  it("resets only the broken field, keeping microphones and song folders", () => {
    const result = v.parse(settingsStoreSchema, {
      general: { language: 42, difficulty: "hard" },
      microphones: [mic],
      songs: { paths: ["/songs"] },
    });
    expect(result.general.language).toBe("en");
    expect(result.general.difficulty).toBe("hard");
    expect(result.microphones).toEqual([mic]);
    expect(result.songs.paths).toEqual(["/songs"]);
  });

  it("drops a broken microphone but keeps the others", () => {
    const result = v.parse(settingsStoreSchema, { microphones: [{ channel: 0 }, mic, "nonsense"] });
    expect(result.microphones).toEqual([mic]);
  });

  it("fills missing microphone fields", () => {
    const result = v.parse(settingsStoreSchema, { microphones: [{ name: "Old mic" }] });
    expect(result.microphones).toEqual([
      { name: "Old mic", channel: 0, color: "sky", delay: 0, gain: 1, threshold: 1 },
    ]);
  });

  it("replaces a section of the wrong type with its defaults", () => {
    const result = v.parse(settingsStoreSchema, { volume: "loud", songs: null });
    expect(result.volume.master).toBe(1);
    expect(result.songs.paths).toEqual([]);
  });
});
