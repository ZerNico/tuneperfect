import { init } from "../lib/orpc";
import { authService } from "./service";

export const requireUser = init
  .errors({
    UNAUTHORIZED: {
      status: 401,
    },
  })
  .middleware(async ({ context, next, errors }) => {
    const accessToken = context.cookies?.get("access_token");

    if (!accessToken) {
      throw errors.UNAUTHORIZED();
    }

    const payload = await authService.verifyAccessToken(accessToken);

    if (!payload) {
      throw errors.UNAUTHORIZED();
    }

    return next({
      context: {
        payload,
      },
    });
  });
