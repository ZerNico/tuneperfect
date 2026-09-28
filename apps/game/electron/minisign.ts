import { ed25519 } from "@noble/curves/ed25519.js";
import { blake2b } from "@noble/hashes/blake2.js";

/**
 * Verifies minisign signatures in the form Tauri's updater uses: both the public key and
 * the `.sig` file are base64-encoded minisign files, as produced by `tauri signer`. This
 * lets release artifacts be signed with the same key as before.
 *
 * Format: https://jedisct1.github.io/minisign/#signature-format
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value.trim()), (char) => char.charCodeAt(0));
}

/** The non-empty lines of a base64-encoded minisign file. */
function lines(encodedFile: string): string[] {
  return (
    decoder
      .decode(fromBase64(encodedFile))
      .split("\n")
      // Only strip line endings: a trusted comment is signed byte for byte.
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.length > 0)
  );
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

interface PublicKey {
  keyId: Uint8Array;
  key: Uint8Array;
}

function parsePublicKey(encoded: string): PublicKey {
  const payload = lines(encoded).find((line) => !line.startsWith("untrusted comment:"));
  const bytes = payload ? fromBase64(payload) : new Uint8Array();
  if (bytes.length !== 42 || decoder.decode(bytes.subarray(0, 2)) !== "Ed") {
    throw new Error("Invalid minisign public key");
  }
  return { keyId: bytes.subarray(2, 10), key: bytes.subarray(10, 42) };
}

/** Whether `signature` (a base64 `.sig` file) is a valid signature of `data` by `publicKey`. */
export function verifyMinisign(data: Uint8Array, signature: string, publicKey: string): boolean {
  const key = parsePublicKey(publicKey);

  const [untrusted, payload, trusted, globalPayload] = lines(signature);
  if (!untrusted?.startsWith("untrusted comment:") || !payload || !trusted?.startsWith("trusted comment:")) {
    return false;
  }
  if (!globalPayload) return false;

  const bytes = fromBase64(payload);
  if (bytes.length !== 74) return false;

  const algorithm = decoder.decode(bytes.subarray(0, 2));
  const keyId = bytes.subarray(2, 10);
  const sig = bytes.subarray(10, 74);
  if (!equal(keyId, key.keyId)) return false;

  // "ED" signs the BLAKE2b-512 hash of the file (what Tauri produces), "Ed" the file itself.
  let message: Uint8Array;
  if (algorithm === "ED") message = blake2b(data, { dkLen: 64 });
  else if (algorithm === "Ed") message = data;
  else return false;

  if (!ed25519.verify(sig, message, key.key)) return false;

  // The trusted comment is covered by a second signature over signature + comment.
  const trustedComment = encoder.encode(trusted.slice("trusted comment: ".length));
  const globalMessage = new Uint8Array(sig.length + trustedComment.length);
  globalMessage.set(sig);
  globalMessage.set(trustedComment, sig.length);
  return ed25519.verify(fromBase64(globalPayload), globalMessage, key.key);
}
