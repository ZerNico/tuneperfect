import { EventPublisher } from "@orpc/server";
import type { Signal } from "./models";

// Dynamic channels:
// - lobby:{lobbyId}:host - Game client subscribes to receive signals from mobile apps
// - lobby:{lobbyId}:guest:{userId} - Mobile app subscribes to receive signals from game client
export const signalingPublisher = new EventPublisher<Record<string, Signal>>();
