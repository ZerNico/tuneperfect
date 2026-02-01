import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../base";
import { env } from "../config/env";

const IceServerSchema = v.object({
  urls: v.union([v.string(), v.array(v.string())]),
  username: v.optional(v.string()),
  credential: v.optional(v.string()),
});

export const webrtcRouter = os.prefix("/webrtc").router({
  getIceServers: base.output(v.array(IceServerSchema)).handler(async () => {
    const iceServers: RTCIceServer[] = [];

    if (env.STUN_URL) {
      iceServers.push({ urls: env.STUN_URL });
    }

    if (env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: env.TURN_URL,
        username: env.TURN_USERNAME,
        credential: env.TURN_CREDENTIAL,
      });
    }

    return iceServers;
  }),
});
