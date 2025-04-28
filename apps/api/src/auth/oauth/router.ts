import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../../base";
import { env } from "../../config/env";
import { setTokenCookie } from "../../utils/cookie";
import { tryCatch } from "../../utils/try-catch";
import { authService } from "../service";
import { oauthService } from "./service";

export const oauthRouter = os.prefix("/providers").router({
  authorize: base
    .route({
      path: "/{provider}/authorize",
      method: "GET",
      successStatus: 302,
    })
    .input(
      v.object({
        provider: v.picklist(["google"]),
      }),
    )
    .handler(async ({ context, errors, input }) => {
      const [result, error] = await tryCatch(oauthService.createAuthorizationURL(input.provider));

      if (error) {
        throw errors.INTERNAL_SERVER_ERROR();
      }

      const stateCookie = new Bun.Cookie("state", result.state, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
        domain: env.COOKIE_DOMAIN,
      });

      const codeVerifierCookie = new Bun.Cookie("codeVerifier", result.codeVerifier, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
        domain: env.COOKIE_DOMAIN,
      });

      const url = await result.url;

      context.resHeaders?.append("set-cookie", stateCookie.serialize());
      context.resHeaders?.append("set-cookie", codeVerifierCookie.serialize());
      context.resHeaders?.append("location", url.href);
    }),

  callback: base
    .route({
      path: "/{provider}/callback",
      method: "GET",
      successStatus: 302,
    })
    .errors({
      BAD_REQUEST: {
        status: 400,
      },
    })
    .input(
      v.object({
        provider: v.picklist(["google"]),
        code: v.string(),
        state: v.string(),
      }),
    )
    .handler(async ({ context, errors, input }) => {
      const cookies = new Bun.CookieMap(context.headers?.get("cookie") ?? undefined);
      const storedState = cookies.get("state");
      const storedCodeVerifier = cookies.get("codeVerifier");

      if (!input.state || !input.code || !storedState || !storedCodeVerifier) {
        throw errors.BAD_REQUEST();
      }

      if (input.state !== storedState) {
        throw errors.BAD_REQUEST();
      }

      const [token, tokenError] = await tryCatch(
        oauthService.exchangeCodeForAccessToken(input.provider, input.code, storedCodeVerifier),
      );

      if (tokenError) {
        throw errors.BAD_REQUEST();
      }

      const [user, userError] = await tryCatch(oauthService.getOrCreateUser(input.provider, token));

      if (userError || !user) {
        throw errors.BAD_REQUEST();
      }

      const accessToken = await authService.generateAccessToken(user);
      const refreshToken = await authService.generateAndStoreRefreshToken(
        user,
        context.headers?.get("user-agent") || "unknown",
      );

      setTokenCookie("access", accessToken.token, accessToken.expires, context.resHeaders ?? new Headers());
      setTokenCookie("refresh", refreshToken.token, refreshToken.expires, context.resHeaders ?? new Headers());
      context.resHeaders?.append("location", "/");
    }),
});
