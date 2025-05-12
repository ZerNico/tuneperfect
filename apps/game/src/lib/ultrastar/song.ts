import type { Voice } from "./voice";

interface Data {
  title: string;
  artist: string;
  bpm: number;
  gap: number;
  videoGap: number;
  hash: string;
  album?: string;
  language?: string;
  edition?: string;
  genre?: string;
  year?: number;
  author?: string;
  relative?: boolean;
  audio?: string;
  cover?: string;
  video?: string;
  background?: string;
  p1?: string;
  p2?: string;
  previewStart?: number;
}

export interface Song extends Data {
  voices: Voice[];
}
