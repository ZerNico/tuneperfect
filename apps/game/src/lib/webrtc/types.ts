// Simplified song data sent to mobile clients
export interface SongSummary {
  hash: string;
  title: string;
  artist: string;
}

// Data channel message types
export type DataChannelMessage = {
  type: "songs";
  data: SongSummary[];
};
