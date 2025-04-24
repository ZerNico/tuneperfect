import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../base";
import { userService } from "../user/service";
import { authService } from "./service";

export const authRouter = os.prefix("/auth").router({
  register: base
    .errors({
      USER_ALREADY_EXISTS: {
        status: 400,
      },
    })
    .input(
      v.object({
        email: v.pipe(v.string(), v.email()),
        password: v.pipe(v.string(), v.minLength(8)),
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const existingUser = await userService.getUserByEmail(input.email);

      if (existingUser) {
        throw errors.USER_ALREADY_EXISTS();
      }

      const user = await userService.createUser(input.email, input.password);

      if (!user) {
        throw errors.INTERNAL_SERVER_ERROR();
      }

      try {
        await authService.sendVerificationEmail(user);
      } catch (error) {
        
      }
    }),

  verifyEmail: base
    .route({
      path: "/verify-email",
      method: "GET",
      successStatus: 303,
    })
    .input(v.object({ token: v.string() }))
    .handler(async ({ input, context, errors }) => {
      context.resHeaders?.set("location", "/");
    }),
});
