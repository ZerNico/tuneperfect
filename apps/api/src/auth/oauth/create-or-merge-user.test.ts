/**
 * Tests for the OAuth account-takeover guard in createOrMergeUser
 * (google.ts / discord.ts):
 *
 * - unverified provider email → rejected (no account creation, no merge)
 * - no existing account → create a new one
 * - existing verified account → merge (link OAuth account)
 * - existing UNVERIFIED account WITH password → UnverifiedEmailExistsError
 *   (an attacker could have pre-registered the victim's email with a password)
 * - existing UNVERIFIED account WITHOUT password → merge + auto-verify
 */
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeUser } from "../../../test/helpers";
import type { UserWithPassword } from "../../types";
import { userService } from "../../user/service";
import { discordOAuthClient } from "./discord";
import { UnverifiedEmailExistsError, googleOAuthClient } from "./google";
import type { DiscordProfile, GoogleProfile } from "./models";

afterEach(() => {
  mock.restore();
});

function makeGoogleProfile(overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  return {
    email: "victim@test.localhost",
    sub: "google-sub-1",
    picture: undefined,
    email_verified: true,
    ...overrides,
  };
}

function makeDiscordProfile(overrides: Partial<DiscordProfile> = {}): DiscordProfile {
  return {
    id: "discord-id-1",
    username: "victim",
    discriminator: "0",
    global_name: null,
    avatar: null,
    email: "victim@test.localhost",
    verified: true,
    ...overrides,
  };
}

function mockExistingUser(user: UserWithPassword | undefined) {
  return spyOn(userService, "getUserByEmailWithPassword").mockResolvedValue(user);
}

describe("google createOrMergeUser", () => {
  it("rejects profiles with an unverified provider email", async () => {
    const lookupSpy = mockExistingUser(undefined);
    const createSpy = spyOn(googleOAuthClient, "createUser");
    const mergeSpy = spyOn(googleOAuthClient, "mergeUser");

    const result = await googleOAuthClient.createOrMergeUser(makeGoogleProfile({ email_verified: false }));

    expect(result).toBeNull();
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it("creates a new user when the email is unknown", async () => {
    mockExistingUser(undefined);
    const created = { ...makeUser({ email: "victim@test.localhost" }), password: null };
    const createSpy = spyOn(googleOAuthClient, "createUser").mockResolvedValue(created);

    const result = await googleOAuthClient.createOrMergeUser(makeGoogleProfile());

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(created);
  });

  it("merges into an existing verified account", async () => {
    const existing = { ...makeUser({ email: "victim@test.localhost", emailVerified: true }), password: "some-hash" };
    mockExistingUser(existing);
    const mergeSpy = spyOn(googleOAuthClient, "mergeUser").mockResolvedValue(existing);

    const result = await googleOAuthClient.createOrMergeUser(makeGoogleProfile());

    expect(mergeSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(existing);
  });

  it("rejects merging into an unverified account that has a password", async () => {
    const existing = {
      ...makeUser({ email: "victim@test.localhost", emailVerified: false }),
      password: "attacker-set-hash",
    };
    mockExistingUser(existing);
    const mergeSpy = spyOn(googleOAuthClient, "mergeUser");

    await expect(googleOAuthClient.createOrMergeUser(makeGoogleProfile())).rejects.toBeInstanceOf(
      UnverifiedEmailExistsError,
    );
    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it("merges and auto-verifies an unverified account without a password", async () => {
    const existing = { ...makeUser({ email: "victim@test.localhost", emailVerified: false }), password: null };
    mockExistingUser(existing);
    const mergeSpy = spyOn(googleOAuthClient, "mergeUser").mockResolvedValue({ ...existing, emailVerified: true });

    const result = await googleOAuthClient.createOrMergeUser(makeGoogleProfile());

    expect(mergeSpy).toHaveBeenCalledTimes(1);
    expect(result?.emailVerified).toBe(true);
  });
});

describe("discord createOrMergeUser", () => {
  it("rejects profiles with an unverified provider email", async () => {
    const lookupSpy = mockExistingUser(undefined);
    const createSpy = spyOn(discordOAuthClient, "createUser");
    const mergeSpy = spyOn(discordOAuthClient, "mergeUser");

    const result = await discordOAuthClient.createOrMergeUser(makeDiscordProfile({ verified: false }));

    expect(result).toBeNull();
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it("creates a new user when the email is unknown", async () => {
    mockExistingUser(undefined);
    const created = { ...makeUser({ email: "victim@test.localhost" }), password: null };
    const createSpy = spyOn(discordOAuthClient, "createUser").mockResolvedValue(created);

    const result = await discordOAuthClient.createOrMergeUser(makeDiscordProfile());

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(created);
  });

  it("merges into an existing verified account", async () => {
    const existing = { ...makeUser({ email: "victim@test.localhost", emailVerified: true }), password: "some-hash" };
    mockExistingUser(existing);
    const mergeSpy = spyOn(discordOAuthClient, "mergeUser").mockResolvedValue(existing);

    const result = await discordOAuthClient.createOrMergeUser(makeDiscordProfile());

    expect(mergeSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(existing);
  });

  it("rejects merging into an unverified account that has a password", async () => {
    const existing = {
      ...makeUser({ email: "victim@test.localhost", emailVerified: false }),
      password: "attacker-set-hash",
    };
    mockExistingUser(existing);
    const mergeSpy = spyOn(discordOAuthClient, "mergeUser");

    await expect(discordOAuthClient.createOrMergeUser(makeDiscordProfile())).rejects.toBeInstanceOf(
      UnverifiedEmailExistsError,
    );
    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it("merges and auto-verifies an unverified account without a password", async () => {
    const existing = { ...makeUser({ email: "victim@test.localhost", emailVerified: false }), password: null };
    mockExistingUser(existing);
    const mergeSpy = spyOn(discordOAuthClient, "mergeUser").mockResolvedValue({ ...existing, emailVerified: true });

    const result = await discordOAuthClient.createOrMergeUser(makeDiscordProfile());

    expect(mergeSpy).toHaveBeenCalledTimes(1);
    expect(result?.emailVerified).toBe(true);
  });
});
