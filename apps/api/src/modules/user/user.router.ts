import { router } from "../../trpc";
import { protectedUserProcedure } from "./user.middleware";

export const userRouter = router({
  me: protectedUserProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),
});
