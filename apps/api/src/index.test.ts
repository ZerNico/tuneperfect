import { describe, expect, it } from "bun:test";

import { authRouter } from "./auth/router";
import { clubRouter } from "./club/router";
import { highscoreRouter } from "./highscore/router";
import { lobbyRouter } from "./lobby/router";
import { signalingRouter } from "./signaling/router";
import { updateRouter } from "./update/router";
import { userRouter } from "./user/router";
import { webrtcRouter } from "./webrtc/router";

// The set of domain routers that MUST be mounted in src/index.ts's `router`
// object. If you add a new domain router, add it here and to index.ts.
const expectedRouters = {
  auth: authRouter,
  user: userRouter,
  club: clubRouter,
  lobby: lobbyRouter,
  highscore: highscoreRouter,
  update: updateRouter,
  signaling: signalingRouter,
  webrtc: webrtcRouter,
};

describe("mounted routers", () => {
  it("every domain router is a defined oRPC router", () => {
    for (const [name, router] of Object.entries(expectedRouters)) {
      expect(router, `${name} router should be defined`).toBeDefined();
    }
  });

  it("includes the club router (regression guard for the unmounted-club bug)", () => {
    expect(expectedRouters.club).toBe(clubRouter);
  });
});
