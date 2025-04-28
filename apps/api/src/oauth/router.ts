import { os } from "@orpc/server";
import * as arctic from "arctic";
import { base } from "../base";

// add google sign in
export const oauthRouter = os.prefix("/oauth").router({
  googleAuthorize: base
    .route({
      path: "/google/authorize",
      method: "GET",
    })
    .handler(async ({ context }) => {
      
    }),

  googleCallback: base
    .route({
      path: "/google/callback",
      method: "GET",
    })
    .handler(async ({ context }) => {}),
});
