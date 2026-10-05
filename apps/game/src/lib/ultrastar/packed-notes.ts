import type { Note, NoteType, Voice } from "~/lib/native/types.gen";

/**
 * Unpacks a song's voices from the scanned library's packed notes. The format is written by
 * `native/src/ultrastar/packed_notes.rs`, which documents it: change both together.
 */

const NOTE_TYPES: readonly NoteType[] = ["Normal", "Golden", "Freestyle", "Rap", "RapGolden"];

const utf8 = new TextDecoder();

export function unpackVoices(bytes: Uint8Array): Voice[] {
  let offset = 0;

  // Varints are summed with multiplication, not shifts: a start beat delta can exceed 32 bits.
  const unsigned = () => {
    let value = 0;
    let scale = 1;
    let byte: number;
    do {
      byte = bytes[offset++]!;
      value += (byte & 0x7f) * scale;
      scale *= 0x80;
    } while (byte & 0x80);
    return value;
  };
  const signed = () => {
    const value = unsigned();
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  };
  const text = (length: number) => {
    const end = offset + length;
    let ascii = true;
    for (let i = offset; i < end; i++) {
      if (bytes[i]! >= 0x80) {
        ascii = false;
        break;
      }
    }
    // Most lyrics are a few ASCII characters, where the decoder's call costs more than the text.
    const value = ascii
      ? String.fromCharCode.apply(null, bytes.subarray(offset, end) as unknown as number[])
      : utf8.decode(bytes.subarray(offset, end));
    offset = end;
    return value;
  };

  const voices: Voice[] = [];
  const voiceCount = unsigned();
  for (let v = 0; v < voiceCount; v++) {
    const phrases: Voice["phrases"] = [];
    const phraseCount = unsigned();
    let startBeat = 0;
    for (let p = 0; p < phraseCount; p++) {
      const disappearBeat = signed();
      const notes: Note[] = [];
      const noteCount = unsigned();
      for (let n = 0; n < noteCount; n++) {
        const type = NOTE_TYPES[bytes[offset++]!] ?? "Normal";
        startBeat += signed();
        const length = signed();
        const txtPitch = signed();
        notes.push({ type, startBeat, length, text: text(unsigned()), txtPitch, midiNote: txtPitch + 60 });
      }
      phrases.push({ disappearBeat, notes });
    }
    voices.push({ phrases });
  }
  return voices;
}
