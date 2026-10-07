import { os } from "@orpc/server";
import { joinURL, withQuery } from "ufo";
import * as v from "valibot";

import { base } from "../../base";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { cookieMaxAge, defaultCookieOptions } from "../../utils/cookie";
import { isValidRedirectUrl } from "../../utils/security";
import { tryCatch } from "../../utils/try-catch";
import { authService } from "../service";
import { UnverifiedEmailExistsError } from "./google";
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
    .input(
      v.object({
        provider: v.picklist(["google", "discord"]),
        // Both are missing when the user cancels on the provider's page: it sends `error` instead
        code: v.optional(v.string()),
        state: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
    )
    .handler(async ({ context, input }) => {
      // The browser is mid-redirect: a JSON error would be a dead end, so every failure goes back to
      // sign-in with a reason the app can explain.
      const backToSignIn = (error: string) => {
        context.resHeaders?.append("location", withQuery(joinURL(env.APP_URL, "/sign-in"), { error }));
      };

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

      if (input.error === "access_denied") {
        backToSignIn("oauth_cancelled");
        return;
      }

      if (!input.state || !input.code || !storedState || !storedCodeVerifier || input.state !== storedState) {
        backToSignIn("oauth_failed");
        return;
      }

      const [tokenError, token] = await tryCatch(
        oauthService.exchangeCodeForAccessToken(input.provider, input.code, storedCodeVerifier),
      );

      if (tokenError) {
        logger.error(tokenError, "Failed to exchange code for access token");
        backToSignIn("oauth_failed");
        return;
      }

      const [userError, user] = await tryCatch(oauthService.getOrCreateUser(input.provider, token));

      if (userError || !user) {
        // Check if the error is because an unverified account with password exists
        if (userError instanceof UnverifiedEmailExistsError) {
          logger.info("Unverified account with password exists, redirecting to sign-in");
          backToSignIn("unverified_email_exists");
          return;
        }
        logger.error(userError, "Failed to get or create user");
        backToSignIn("oauth_failed");
        return;
      }

      const accessToken = await authService.generateAccessToken(user);
      const refreshToken = await authService.generateAndStoreRefreshToken(
        user,
        context.headers?.get("user-agent") || "unknown",
      );

      context.setCookie?.("access_token", accessToken.token, {
        ...defaultCookieOptions,
        maxAge: cookieMaxAge(accessToken.expires),
      });
      context.setCookie?.("refresh_token", refreshToken.token, {
        ...defaultCookieOptions,
        maxAge: cookieMaxAge(refreshToken.expires),
      });
      // "/" would be the API's own root: without a stored redirect, go to the app
      context.resHeaders?.append("location", storedRedirect ?? env.APP_URL);
    }),
});
