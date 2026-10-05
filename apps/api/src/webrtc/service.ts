import { createHmac, randomBytes } from "node:crypto";

import { env } from "../config/env";

export interface TurnCredentials {
  username: string;
  credential: string;
}

/**
 * Time-limited TURN credentials in coturn's "TURN REST API" form (`--use-auth-secret`): the
 * username carries its expiry, the credential is an HMAC of the username with the shared
 * secret. coturn recomputes it from its own copy of the secret, so nothing is stored per
 * user, and neither the expiry nor the signature can be changed without the secret.
 */
export function createTurnCredentials(
  secret: string,
  ttlSeconds: number,
  now: Date = new Date(),
  // Hex: no ":" (coturn's separator between expiry and id).
  id: string = randomBytes(8).toString("hex"),
): TurnCredentials {
  const username = `${Math.floor(now.getTime() / 1000) + ttlSeconds}:${id}`;
  return { username, credential: createHmac("sha1", secret).update(username).digest("base64") };
}

class WebRTCService {
  /** STUN, plus TURN with fresh credentials when it's configured. */
  getIceServers(now: Date = new Date()): RTCIceServer[] {
    const iceServers: RTCIceServer[] = [];

    if (env.STUN_URL) {
      iceServers.push({ urls: env.STUN_URL });
    }

    if (env.TURN_SECRET && env.TURN_URLS.length > 0) {
      iceServers.push({
        urls: env.TURN_URLS,
        ...createTurnCredentials(env.TURN_SECRET, env.TURN_CREDENTIAL_TTL, now),
      });
    }

    return iceServers;
  }
}

export const webrtcService = new WebRTCService();
