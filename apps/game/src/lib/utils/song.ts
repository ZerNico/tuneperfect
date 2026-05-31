import { t } from "~/lib/i18n";
import type { Song } from "~/lib/ultrastar/song";

export function getVoiceName(song: Song | null, voiceIndex: number): string {
  if (!song) return `${t("sing.voice")} ${voiceIndex + 1}`;
  const voiceKey = `p${voiceIndex + 1}` as "p1" | "p2";
  return song[voiceKey] || `${t("sing.voice")} ${voiceIndex + 1}`;
}

export function isDuet(song: Song | null | undefined): boolean {
  return song != null && song.voices.length > 1;
}
