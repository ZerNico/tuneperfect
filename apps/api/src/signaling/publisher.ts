import { EventPublisher } from "@orpc/server";

import type { Signal } from "./models";

// Dynamic channels:
// - lobby:{lobbyId}:host - Game client subscribes to receive signals from mobile apps
// - lobby:{lobbyId}:guest:{userId} - Mobile app subscribes to receive signals from game client
//
// NOTE: This publisher is in-memory and therefore only works with a single API
// instance. If the API is ever scaled to multiple replicas, host and guest may
// connect to different pods and signals will not be delivered. Backing this with
// Redis pub/sub (or sticky sessions) would be required before scaling out.
export const signalingPublisher = new EventPublisher<Record<string, Signal>>();
