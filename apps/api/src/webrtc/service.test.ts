import { describe, expect, it } from "bun:test";

import { createTurnCredentials } from "./service";

describe("createTurnCredentials", () => {
  // Checked independently: printf %s "1700086400:abc" | openssl dgst -sha1 -hmac north -binary | base64
  it("signs the expiry and id the way coturn checks them", () => {
    expect(createTurnCredentials("north", 86_400, new Date(1_700_000_000_000), "abc")).toEqual({
      username: "1700086400:abc",
      credential: "rdRes6D4AdS5DA7lyYxp56skEtQ=",
    });
  });

  it("counts the expiry in whole seconds", () => {
    const { username } = createTurnCredentials("north", 60, new Date(1_700_000_000_999), "abc");
    expect(username).toBe("1700000060:abc");
  });

  it("gives every credential its own id, without coturn's separator", () => {
    const now = new Date();
    const first = createTurnCredentials("north", 60, now).username.split(":");
    const second = createTurnCredentials("north", 60, now).username.split(":");
    expect(first).toHaveLength(2);
    expect(first[1]).not.toBe(second[1]);
  });
});
