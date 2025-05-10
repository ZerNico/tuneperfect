import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../../base";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { defaultCookieOptions } from "../../utils/cookie";
import { isValidRedirectUrl } from "../../utils/security";
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
        provider: v.picklist(["google", "discord"]),
        redirect: v.optional(v.string()),
      }),
    )
    .handler(async ({ context, errors, input }) => {
      const [error, result] = await tryCatch(oauthService.createAuthorizationURL(input.provider));

      if (error) {
        throw errors.INTERNAL_SERVER_ERROR();
      }

      const redirectUrl = isValidRedirectUrl(input.redirect, [env.APP_URL]) ? input.redirect : undefined;

      context.setCookie?.("state", result.state, {
        ...defaultCookieOptions,
        maxAge: 60 * 10, // 10 minutes
      });
      context.setCookie?.("codeVerifier", result.codeVerifier, {
        ...defaultCookieOptions,
        maxAge: 60 * 10, // 10 minutes
      });
      if (redirectUrl) {
        context.setCookie?.("redirect", redirectUrl, {
          ...defaultCookieOptions,
          maxAge: 60 * 10, // 10 minutes
        });
      }

      context.resHeaders?.append("location", result.url.href);
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
        provider: v.picklist(["google", "discord"]),
        code: v.string(),
        state: v.string(),
      }),
    )
    .handler(async ({ context, errors, input }) => {
      const storedState = context.cookies?.get("state");
      const storedCodeVerifier = context.cookies?.get("codeVerifier");
      const storedRedirect = context.cookies?.get("redirect");

      context.deleteCookie?.("state", {
        ...defaultCookieOptions,
      });
      context.deleteCookie?.("codeVerifier", {
        ...defaultCookieOptions,
      });
      context.deleteCookie?.("redirect", {
        ...defaultCookieOptions,
      });

      if (!input.state || !input.code || !storedState || !storedCodeVerifier) {
        throw errors.BAD_REQUEST();
      }

      if (input.state !== storedState) {
        throw errors.BAD_REQUEST();
      }

      const [tokenError, token] = await tryCatch(
        oauthService.exchangeCodeForAccessToken(input.provider, input.code, storedCodeVerifier),
      );

      if (tokenError) {
        logger.error(tokenError, "Failed to exchange code for access token");
        throw errors.BAD_REQUEST();
      }

      const [userError, user] = await tryCatch(oauthService.getOrCreateUser(input.provider, token));

      if (userError || !user) {
        logger.error(userError, "Failed to get or create user");
        throw errors.BAD_REQUEST();
      }

      const accessToken = await authService.generateAccessToken(user);
      const refreshToken = await authService.generateAndStoreRefreshToken(
        user,
        context.headers?.get("user-agent") || "unknown",
      );

      context.setCookie?.("access_token", accessToken.token, {
        ...defaultCookieOptions,
        maxAge: accessToken.expires.getTime() - Date.now(),
      });
      context.setCookie?.("refresh_token", refreshToken.token, {
        ...defaultCookieOptions,
        maxAge: refreshToken.expires.getTime() - Date.now(),
      });
      context.resHeaders?.append("location", storedRedirect ?? "/");
    }),
});
