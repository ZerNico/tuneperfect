import dns from "node:dns";
import net from "node:net";

/**
 * Everything that isn't the public internet: this machine, private and carrier-grade NAT
 * networks, link-local (cloud metadata lives there), multicast, and the reserved,
 * documentation and translation ranges. IPv4-mapped IPv6 is blocked outright, since a mapped
 * address can hide any of the IPv4 ranges.
 *
 * One list per family: a `BlockList` also matches IPv4 addresses against IPv4-mapped IPv6
 * rules, so `::ffff:0:0/96` would block every IPv4 address.
 */
const NON_PUBLIC_IPV4 = new net.BlockList();
const NON_PUBLIC_IPV6 = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC_IPV4.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 127],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC_IPV6.addSubnet(address, prefix, "ipv6");
}

/** Whether `address` (an IP literal, without brackets) is on the public internet. */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  return family === 4 ? !NON_PUBLIC_IPV4.check(address, "ipv4") : !NON_PUBLIC_IPV6.check(address, "ipv6");
}

/** A connection that would have reached a non-public address. */
export class NonPublicAddressError extends Error {
  constructor(host: string) {
    super(`${host} does not resolve to a public address`);
    this.name = "NonPublicAddressError";
  }
}

/**
 * A `lookup` for sockets that may only reach the public internet. The addresses it checks
 * are the ones the socket connects to, so a hostname can't pass the check and then rebind
 * to a private address. A name with any non-public address is refused outright.
 */
export const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { family: options.family, hints: options.hints, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    if (addresses.length === 0 || !addresses.every(({ address }) => isPublicAddress(address))) {
      return callback(new NonPublicAddressError(hostname), "");
    }
    if (options.all) return callback(null, addresses);
    const [first] = addresses;
    callback(null, first!.address, first!.family);
  });
};
