import { describe, expect, it } from "vitest";

import { unpackVoices } from "./packed-notes";

const note = (type: string, startBeat: number, length: number, txtPitch: number, text: string) => ({
  type,
  startBeat,
  length,
  text,
  txtPitch,
  midiNote: txtPitch + 60,
});

describe("unpackVoices", () => {
  // Packed by `packs_the_shared_fixture` in `native/src/ultrastar/packed_notes.rs`: change both together.
  it("unpacks the shared fixture", () => {
    const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
    const bytes = new Uint8Array([
      2,
      2,
      20,
      2,
      // Normal +0 len 4 pitch 5 "Hel", Golden +4 len 2 pitch -3 "lo "
      0,
      0,
      8,
      10,
      3,
      ...ascii("Hel"),
      1,
      8,
      4,
      5,
      3,
      ...ascii("lo "),
      216,
      4,
      1,
      // Freestyle +196 len 100 pitch 0 "wörld"
      2,
      136,
      3,
      200,
      1,
      0,
      6,
      ...ascii("w"),
      0xc3,
      0xb6,
      ...ascii("rld"),
      1,
      1,
      2,
      // Rap -2 len 1 pitch 12 "", RapGolden +3 len 1 pitch 12 "~"
      3,
      3,
      2,
      24,
      0,
      4,
      6,
      2,
      24,
      1,
      ...ascii("~"),
    ]);

    expect(unpackVoices(bytes)).toEqual([
      {
        phrases: [
          { disappearBeat: 10, notes: [note("Normal", 0, 4, 5, "Hel"), note("Golden", 4, 2, -3, "lo ")] },
          { disappearBeat: 300, notes: [note("Freestyle", 200, 100, 0, "wörld")] },
        ],
      },
      {
        phrases: [{ disappearBeat: -1, notes: [note("Rap", -2, 1, 12, ""), note("RapGolden", 1, 1, 12, "~")] }],
      },
    ]);
  });

  it("unpacks a song without voices", () => {
    expect(unpackVoices(new Uint8Array([0]))).toEqual([]);
  });
});
