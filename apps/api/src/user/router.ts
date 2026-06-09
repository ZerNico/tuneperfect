import { os } from "@orpc/server";
import * as v from "valibot";

import { requireUser } from "../auth/middleware";
import { authService } from "../auth/service";
import { base } from "../base";
import { env } from "../config/env";
import type { UserWithPassword } from "../types";
import { UsernameSchema } from "./models";
import { userService } from "./service";

export const userRouter = os.prefix("/users").router({
  getMe: base
    .errors({
      USER_NOT_FOUND: {
        status: 404,
      },
    })
    .use(requireUser)
    .handler(async ({ context, errors }) => {
      const user = await userService.getUserById(context.payload.sub);
      if (!user) {
        throw errors.USER_NOT_FOUND();
      }

      return user;
    }),

  updateMe: base
    .errors({
      USERNAME_ALREADY_TAKEN: {
        status: 400,
      },
      INVALID_CURRENT_PASSWORD: {
        status: 403,
      },
    })
    .input(
      v.object({
        username: v.optional(UsernameSchema),
        imageFile: v.optional(
          v.pipe(
            v.instance(File),
            v.mimeType(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
            v.maxSize(1024 * 1024 * 5), // 5MB
          ),
        ),
        password: v.optional(v.pipe(v.string(), v.minLength(8))),
        currentPassword: v.optional(v.string()),
      }),
    )
    .use(requireUser)
    .handler(async ({ context, errors, input }) => {
      const newUser: Partial<UserWithPassword> = {
        username: input.username,
      };

      if (newUser.username) {
        const user = await userService.getUserByUsername(newUser.username);
        if (user && user.id !== context.payload.sub) {
          throw errors.USERNAME_ALREADY_TAKEN();
        }
      }

      if (input.imageFile) {
        await userService.storeUserImage(context.payload.sub, input.imageFile);
        newUser.image = `/v1.0/users/${context.payload.sub}/image.webp?t=${Date.now()}`;
      }

      if (input.password) {
        const user = await userService.getUserByIdWithPassword(context.payload.sub);

        // Accounts with an existing password must confirm it before setting a new one.
        if (user?.password) {
          const isCurrentPasswordValid = input.currentPassword
            ? await Bun.password.verify(input.currentPassword, user.password)
            : false;

          if (!isCurrentPasswordValid) {
            throw errors.INVALID_CURRENT_PASSWORD();
          }
        }

        newUser.password = await authService.hashPassword(input.password);
      }

      const updatedUser = await userService.updateUser(context.payload.sub, newUser);

      if (input.password) {
        // Invalidate all other sessions after a password change.
        const currentRefreshToken = context.cookies?.get("refresh_token");
        await authService.deleteAllRefreshTokensForUser(context.payload.sub, currentRefreshToken ?? undefined);
      }

      return updatedUser;
    }),

  getUserImage: base
    .route({
      path: "/{id}/image.webp",
      method: "GET",
    })
    .errors({
      USER_NOT_FOUND: {
        status: 404,
      },
    })
    .input(v.object({ id: v.pipe(v.string(), v.uuid()), t: v.optional(v.string()) }))
    .handler(async ({ errors, input, context }) => {
      const file = Bun.file(`${env.UPLOADS_PATH}/users/${input.id}.webp`);
      if (!(await file.exists())) {
        throw errors.USER_NOT_FOUND();
      }

      context.resHeaders?.set("Content-Type", "image/webp");
      context.resHeaders?.set("Cache-Control", "public, max-age=31536000");

      return file;
    }),
});
