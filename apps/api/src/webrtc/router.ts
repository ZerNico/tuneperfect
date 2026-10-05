import { os } from "@orpc/server";
import * as v from "valibot";

import { base } from "../base";
import { requireLobbyOrUser } from "../lobby/middleware";
import { webrtcService } from "./service";

const IceServerSchema = v.object({
  urls: v.union([v.string(), v.array(v.string())]),
  username: v.optional(v.string()),
  credential: v.optional(v.string()),
});

export const webrtcRouter = os.prefix("/webrtc").router({
  // Only a game (lobby token) or a signed-in phone gets TURN credentials: they let the holder
  // relay traffic through our server. Clients keep them for an hour, so a few calls per
  // household are plenty.
  getIceServers: base
    .use(requireLobbyOrUser)
    .meta({ rateLimit: { limit: 30, windowMs: 1000 * 60 * 5 } })
    // Released games read this as an array and keep the first answer for their whole session.
    .output(v.array(IceServerSchema))
    .handler(() => webrtcService.getIceServers()),
});
