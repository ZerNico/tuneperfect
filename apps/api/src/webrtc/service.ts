import { createHmac, randomBytes } from "node:crypto";

import { env } from "../config/env";
import { lobbyService } from "../lobby/service";
import { userService } from "../user/service";

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

/** Who asks for ICE servers: a game (by its lobby token) or a signed-in phone. */
export interface IceServerPrincipal {
  type: "lobby" | "access";
  id: string;
}

class WebRTCService {
  /**
   * STUN, plus TURN with fresh credentials when it's configured and the caller may relay: a game
   * once a signed-in phone joined its lobby (creating a lobby needs no account), a phone while it's
   * in a lobby. Relays are what phones and games connect through, so that's when they're needed.
   */
  async getIceServers(principal: IceServerPrincipal, now: Date = new Date()): Promise<RTCIceServer[]> {
    const iceServers: RTCIceServer[] = [];

    if (env.STUN_URL) {
      iceServers.push({ urls: env.STUN_URL });
    }

    if (env.TURN_SECRET && env.TURN_URLS.length > 0 && (await this.mayRelay(principal))) {
      iceServers.push({
        urls: env.TURN_URLS,
        ...createTurnCredentials(env.TURN_SECRET, env.TURN_CREDENTIAL_TTL, now, turnUserId(env.TURN_SECRET, principal)),
      });
    }

    return iceServers;
  }

  private async mayRelay(principal: IceServerPrincipal) {
    if (principal.type === "lobby") {
      const lobby = await lobbyService.getLobbyById(principal.id);
      return (lobby?.users.length ?? 0) > 0;
    }
    const user = await userService.getUserById(principal.id);
    return !!user?.lobbyId;
  }
}

/**
 * The same id for every credential of a lobby or account, so coturn's per-user quota counts all
 * of their relays, across refetches. Opaque (and hex, without coturn's ":" separator), so coturn's
 * logs don't show lobby or user ids.
 */
function turnUserId(secret: string, principal: IceServerPrincipal) {
  return createHmac("sha256", secret).update(`turn-user:${principal.type}:${principal.id}`).digest("hex").slice(0, 16);
}

export const webrtcService = new WebRTCService();
