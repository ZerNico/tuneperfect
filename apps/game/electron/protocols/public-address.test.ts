import { describe, expect, it } from "vitest";

import { isPublicAddress, NonPublicAddressError, publicLookup } from "./public-address";

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "17.253.144.10", "2a00:1450:4001:80b::200e", "2606:4700::6810:84e5"])(
    "%s is public",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.178.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.251",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:8.8.8.8",
    "64:ff9b::7f00:1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "localhost",
    "",
  ])("%s is not", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe("publicLookup", () => {
  const lookup = (host: string, all: boolean) =>
    new Promise<unknown>((resolve, reject) =>
      publicLookup(host, { all }, (error, address) => (error ? reject(error) : resolve(address))),
    );

  it("refuses names that resolve to this machine", async () => {
    await expect(lookup("localhost", true)).rejects.toBeInstanceOf(NonPublicAddressError);
    await expect(lookup("localhost", false)).rejects.toBeInstanceOf(NonPublicAddressError);
  });
});
