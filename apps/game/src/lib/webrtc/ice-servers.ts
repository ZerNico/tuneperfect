import { createIceServerSource } from "@tuneperfect/webrtc/utils";

import { orpcClient } from "../orpc";

/** STUN and TURN servers for connections to phones, from the API. */
export const getIceServers = createIceServerSource(() =>
  orpcClient.webrtc.getIceServers(undefined, { signal: AbortSignal.timeout(10_000) }),
);
