import { os } from "@orpc/server";
import * as v from "valibot";
import { requireUser } from "../auth/middleware";
import { authService } from "../auth/service";
import { base } from "../base";
import { env } from "../config/env";
import type { UserWithPassword } from "../types";
import { UsernameSchema } from "./models";
import { userService } from "./service";

export const userRouter = os.prefix("/user").router({
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
    })
    .input(
      v.object({
        username: v.optional(UsernameSchema),
        imageFile: v.optional(
          v.pipe(
            v.instance(File),
            v.mimeType(["image/png", "image/jpeg", "image/jpg"]),
            v.maxSize(1024 * 1024 * 5), // 5MB
          ),
        ),
        password: v.optional(v.string()),
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
        newUser.image = `/v1.0/user/${context.payload.sub}/image.webp?t=${Date.now()}`;
      }

      if (input.password) {
        newUser.password = await authService.hashPassword(input.password);
      }

      const updatedUser = await userService.updateUser(context.payload.sub, newUser);

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
    .input(v.object({ id: v.string(), t: v.optional(v.string()) }))
    .handler(async ({ errors, input, context }) => {
      const file = Bun.file(`${env.UPLOADS_PATH}/users/${input.id}.webp`);
      if (!file.exists()) {
        throw errors.USER_NOT_FOUND();
      }

      context.resHeaders?.set("Content-Type", "image/webp");
      context.resHeaders?.set("Cache-Control", "public, max-age=31536000");

      return file;
    }),
});
