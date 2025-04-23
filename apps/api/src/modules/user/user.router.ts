import * as v from "valibot";
import { auth } from "../../config/auth";
import { router } from "../../trpc";
import { protectedUserProcedure } from "./user.middleware";
import { userService } from "./user.service";

export const userRouter = router({
  me: protectedUserProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  update: protectedUserProcedure
    .input(
      v.object({
        username: v.pipe(
          v.string(),
          v.minLength(3, "Username must be at least 3 characters"),
          v.maxLength(20, "Username must be at most 20 characters"),
          v.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await userService.update(ctx.user.id, input);

      return user;
    }),

  updateImage: protectedUserProcedure
    .input(
      v.pipe(
        v.instance(FormData),
        v.transform((input) => {
          const image = input.get("image");
          return {
            image: image,
          };
        }),
        v.object({
          image: v.pipe(v.instance(File)),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = await input.image.arrayBuffer();
      console.log(bytes);
    }),
});
