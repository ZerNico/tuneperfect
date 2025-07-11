import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../base";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { userService } from "../user/service";
import { defaultCookieOptions } from "../utils/cookie";
import { executeWithConstantTime } from "../utils/security";
import { oauthRouter } from "./oauth/router";
import { authService } from "./service";

export const authRouter = os.prefix("/auth").router({
  signUp: base
    .errors({
      EMAIL_ALREADY_EXISTS: {
        status: 400,
      },
    })
    .meta({
      rateLimit: {
        limit: 10,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(
      v.object({
        email: v.pipe(v.string(), v.email()),
        password: v.pipe(v.string(), v.minLength(8)),
        redirect: v.optional(v.string()),
      }),
    )
    .handler(async ({ input, errors }) => {
      const existingUser = await userService.getUserByEmail(input.email);

      if (existingUser) {
        throw errors.EMAIL_ALREADY_EXISTS();
      }

      const user = await userService.createUser(input.email, input.password);

      if (!user) {
        throw errors.INTERNAL_SERVER_ERROR();
      }

      try {
        await authService.sendVerificationEmail(user, { redirect: input.redirect });
      } catch (error) {
        logger.warn(error, "Failed to send verification email");
      }
    }),

  signIn: base
    .route({
      path: "/sign-in",
      method: "POST",
    })
    .errors({
      INVALID_CREDENTIALS: {
        status: 401,
      },
      EMAIL_NOT_VERIFIED: {
        status: 403,
      },
    })
    .meta({
      rateLimit: {
        limit: 50,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(v.object({ email: v.string(), password: v.string() }))
    .handler(async ({ input, errors, context }) => {
      await executeWithConstantTime(async () => {
        const user = await authService.comparePasswords(input.password, input.email);

        if (!user) {
          throw errors.INVALID_CREDENTIALS();
        }

        if (!user.emailVerified) {
          throw errors.EMAIL_NOT_VERIFIED();
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
      }, 500);
    }),

  resendVerificationEmail: base
    .route({
      path: "/resend-verification-email",
      method: "POST",
    })
    .meta({
      rateLimit: {
        limit: 3,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(
      v.object({
        email: v.pipe(v.string(), v.email()),
        redirect: v.optional(v.string()),
      }),
    )
    .handler(async ({ input }) => {
      await executeWithConstantTime(async () => {
        const user = await userService.getUserByEmail(input.email);

        if (!user || user.emailVerified) {
          return;
        }

        await authService.sendVerificationEmail(user, { redirect: input.redirect });
      }, 500);
    }),

  verifyEmail: base
    .route({
      path: "/verify-email",
      method: "GET",
      successStatus: 303,
    })
    .errors({
      VERIFICATION_TOKEN_NOT_FOUND: {
        status: 404,
      },
    })
    .meta({
      rateLimit: {
        limit: 20,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(v.object({ token: v.string(), redirect: v.optional(v.string()) }))
    .handler(async ({ input, context, errors }) => {
      const verificationToken = await authService.verifyAndDeleteVerificationToken(input.token, "email_verification");

      if (!verificationToken) {
        throw errors.VERIFICATION_TOKEN_NOT_FOUND();
      }

      await userService.updateUser(verificationToken.userId, { emailVerified: true });

      context.resHeaders?.set("location", input.redirect || env.APP_URL);
    }),

  requestPasswordReset: base
    .route({
      path: "/request-password-reset",
      method: "POST",
    })
    .meta({
      rateLimit: {
        limit: 3,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(
      v.object({
        email: v.pipe(v.string(), v.email()),
      }),
    )
    .handler(async ({ input }) => {
      await executeWithConstantTime(async () => {
        const user = await userService.getUserByEmail(input.email);

        if (!user) {
          return;
        }

        await authService.sendPasswordResetEmail(user);
      }, 500);
    }),

  resetPassword: base
    .route({
      path: "/reset-password",
      method: "POST",
    })
    .errors({
      RESET_TOKEN_NOT_FOUND: {
        status: 404,
      },
      PASSWORD_TOO_SHORT: {
        status: 400,
      },
    })
    .meta({
      rateLimit: {
        limit: 5,
        windowMs: 1000 * 60 * 5,
      },
    })
    .input(
      v.object({
        token: v.string(),
        password: v.pipe(v.string(), v.minLength(8)),
      }),
    )
    .handler(async ({ input, errors }) => {
      const verificationToken = await authService.verifyAndDeleteVerificationToken(input.token, "password_reset");

      if (!verificationToken) {
        throw errors.RESET_TOKEN_NOT_FOUND();
      }

      const hashedPassword = await authService.hashPassword(input.password);
      await userService.updateUser(verificationToken.userId, { password: hashedPassword });
    }),

  providers: oauthRouter,

  refreshToken: base
    .errors({
      UNAUTHORIZED: {
        status: 401,
      },
    })
    .handler(async ({ context, errors }) => {
      const refreshToken = context.cookies?.get("refresh_token");

      if (!refreshToken) {
        context.deleteCookie?.("access_token", { ...defaultCookieOptions });
        context.deleteCookie?.("refresh_token", { ...defaultCookieOptions });
        throw errors.UNAUTHORIZED();
      }

      const newRefreshToken = await authService.verifyAndRotateRefreshToken(refreshToken);

      if (!newRefreshToken) {
        context.deleteCookie?.("access_token", { ...defaultCookieOptions });
        context.deleteCookie?.("refresh_token", { ...defaultCookieOptions });
        throw errors.UNAUTHORIZED();
      }

      const accessToken = await authService.generateAccessToken(newRefreshToken.user);

      context.setCookie?.("access_token", accessToken.token, {
        ...defaultCookieOptions,
        maxAge: accessToken.expires.getTime() - Date.now(),
      });
      context.setCookie?.("refresh_token", newRefreshToken.token, {
        ...defaultCookieOptions,
        maxAge: newRefreshToken.expires.getTime() - Date.now(),
      });
    }),

  signOut: base
    .route({
      path: "/sign-out",
      method: "POST",
    })
    .handler(async ({ context }) => {
      const refreshToken = context.cookies?.get("refresh_token");

      if (refreshToken) {
        await authService.deleteRefreshToken(refreshToken);
      }

      context.deleteCookie?.("access_token", { ...defaultCookieOptions });
      context.deleteCookie?.("refresh_token", { ...defaultCookieOptions });
    }),
});
