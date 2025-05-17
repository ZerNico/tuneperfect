export type NoteType = "Normal" | "Golden" | "Freestyle" | "Rap" | "RapGolden";

export interface Note {
  type: NoteType;
  startBeat: number;
  length: number;
  text: string;
  txtPitch: number;
  midiNote: number;
}

