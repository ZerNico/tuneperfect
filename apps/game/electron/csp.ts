/** The API's origin, from the renderer's `VITE_API_URL` at build time (see `scripts/build-electron.ts`). */
const API_ORIGIN = URL.parse(process.env.TUNEPERFECT_API_URL ?? "")?.origin ?? "";

/** The native media server on loopback: song files, covers and the YouTube embed page. */
const LOCAL = "http://localhost:* http://127.0.0.1:*";

const TUNEPERFECT = "https://*.tuneperfect.org https://*.tuneperfect.localhost";
const POSTHOG = "https://eu.i.posthog.com https://eu-assets.i.posthog.com";

/**
 * Content Security Policy for the app's pages. YouTube only ever runs inside the embed
 * page, a separate document on the media server with its own policy, so the app itself
 * needs no third-party scripts.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Solid sets some styles through the style attribute, and Vite injects CSS as <style>
  // tags in development. Inline styles can't run code, so allowing them costs little.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: ${LOCAL} ${TUNEPERFECT} https://*.googleusercontent.com https://cdn.discordapp.com https://usdb.animux.de`,
  `media-src 'self' data: ${LOCAL}`,
  // The API (requests and event streams), PostHog, the media server, and Vite's HMR socket in development.
  `connect-src 'self' ${LOCAL} ws://localhost:* ${API_ORIGIN} ${TUNEPERFECT} ${POSTHOG}`,
  `frame-src ${LOCAL} https://www.youtube.com https://www.youtube-nocookie.com`,
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");
