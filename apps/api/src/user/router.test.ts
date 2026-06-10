import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { authedContext, expectORPCError, makeUser } from "../../test/helpers";
import { authService } from "../auth/service";
import { userRouter } from "./router";
import { userService } from "./service";

afterEach(() => {
  mock.restore();
});

describe("updateMe authentication", () => {
  it("rejects requests without an access token", async () => {
    await expectORPCError(
      call(
        userRouter.updateMe,
        { username: "newname" },
        { context: { cookies: new Bun.CookieMap(), headers: new Headers(), resHeaders: new Headers() } },
      ),
      "UNAUTHORIZED",
    );
  });

  it("rejects requests with an invalid access token", async () => {
    const cookies = new Bun.CookieMap();
    cookies.set("access_token", "not-a-jwt");

    await expectORPCError(
      call(
        userRouter.updateMe,
        { username: "newname" },
        { context: { cookies, headers: new Headers(), resHeaders: new Headers() } },
      ),
      "UNAUTHORIZED",
    );
  });
});

describe("updateMe username", () => {
  it("rejects a username already taken by another user", async () => {
    const user = makeUser();
    const otherUser = makeUser({ username: "taken" });
    spyOn(userService, "getUserByUsername").mockResolvedValue(otherUser);

    await expectORPCError(
      call(userRouter.updateMe, { username: "taken" }, { context: await authedContext(user) }),
      "USERNAME_ALREADY_TAKEN",
    );
  });

  it("allows keeping your own username", async () => {
    const user = makeUser({ username: "myname" });
    spyOn(userService, "getUserByUsername").mockResolvedValue(user);
    const updateSpy = spyOn(userService, "updateUser").mockResolvedValue({ ...user, password: null });

    await call(userRouter.updateMe, { username: "myname" }, { context: await authedContext(user) });

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});

describe("updateMe password change", () => {
  it("rejects a password shorter than 8 characters", async () => {
    const user = makeUser();

    await expectORPCError(
      call(userRouter.updateMe, { password: "short" }, { context: await authedContext(user) }),
      "BAD_REQUEST",
    );
  });

  it("allows OAuth-only accounts to set a first password without a current password", async () => {
    const user = makeUser();
    spyOn(userService, "getUserByIdWithPassword").mockResolvedValue({ ...user, password: null });
    const updateSpy = spyOn(userService, "updateUser").mockResolvedValue({ ...user, password: "stored-hash" });
    const revokeSpy = spyOn(authService, "deleteAllRefreshTokensForUser").mockResolvedValue();

    await call(userRouter.updateMe, { password: "brand-new-password" }, { context: await authedContext(user) });

    const data = updateSpy.mock.calls[0]?.[1];
    expect(data?.password).toStartWith("$argon2id$");
    expect(await Bun.password.verify("brand-new-password", data?.password as string)).toBe(true);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it("requires the current password when one exists", async () => {
    const user = makeUser();
    const hash = await authService.hashPassword("old-password-123");
    spyOn(userService, "getUserByIdWithPassword").mockResolvedValue({ ...user, password: hash });
    const updateSpy = spyOn(userService, "updateUser");

    await expectORPCError(
      call(userRouter.updateMe, { password: "new-password-123" }, { context: await authedContext(user) }),
      "INVALID_CURRENT_PASSWORD",
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    const user = makeUser();
    const hash = await authService.hashPassword("old-password-123");
    spyOn(userService, "getUserByIdWithPassword").mockResolvedValue({ ...user, password: hash });
    const updateSpy = spyOn(userService, "updateUser");

    await expectORPCError(
      call(
        userRouter.updateMe,
        { password: "new-password-123", currentPassword: "not-the-old-password" },
        { context: await authedContext(user) },
      ),
      "INVALID_CURRENT_PASSWORD",
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("changes the password with the correct current password and revokes other sessions", async () => {
    const user = makeUser();
    const hash = await authService.hashPassword("old-password-123");
    spyOn(userService, "getUserByIdWithPassword").mockResolvedValue({ ...user, password: hash });
    const updateSpy = spyOn(userService, "updateUser").mockResolvedValue({ ...user, password: "stored-hash" });
    const revokeSpy = spyOn(authService, "deleteAllRefreshTokensForUser").mockResolvedValue();

    await call(
      userRouter.updateMe,
      { password: "new-password-123", currentPassword: "old-password-123" },
      { context: await authedContext(user, { refresh_token: "current-refresh-token" }) },
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    // The current session must survive: its refresh token is excluded from revocation.
    expect(revokeSpy).toHaveBeenCalledWith(user.id, "current-refresh-token");
  });

  it("never returns the password hash to the client", async () => {
    const user = makeUser();
    spyOn(userService, "getUserByIdWithPassword").mockResolvedValue({ ...user, password: null });
    spyOn(userService, "updateUser").mockResolvedValue({ ...user, password: "stored-hash" });
    spyOn(authService, "deleteAllRefreshTokensForUser").mockResolvedValue();

    const result = await call(
      userRouter.updateMe,
      { password: "brand-new-password" },
      { context: await authedContext(user) },
    );

    expect(result).not.toHaveProperty("password");
  });
});
