// Simplified song data received from game client
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
