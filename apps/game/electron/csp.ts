/** The API's origin, from the renderer's `VITE_API_URL` at build time (see `scripts/build-electron.ts`). */
const API_ORIGIN = URL.parse(process.env.TUNEPERFECT_API_URL ?? "")?.origin ?? "";

/** Song files: audio, video and covers (`protocols/media.ts`). */
const MEDIA = "media:";
/** The loopback page hosting YouTube embeds (`youtube-embed/server.ts`). */
const YOUTUBE_EMBED = "http://localhost:*";

const TUNEPERFECT = "https://*.tuneperfect.org https://*.tuneperfect.localhost";
const POSTHOG = "https://eu.i.posthog.com https://eu-assets.i.posthog.com";

/**
 * Content Security Policy for the app's pages. YouTube only ever runs inside the embed
 * page, a separate document on loopback with its own policy, so the app itself needs no
 * third-party scripts.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Solid sets some styles through the style attribute, and Vite injects CSS as <style>
  // tags in development. Inline styles can't run code, so allowing them costs little.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: ${MEDIA} ${TUNEPERFECT} https://*.googleusercontent.com https://cdn.discordapp.com https://usdb.animux.de`,
  `media-src 'self' data: ${MEDIA}`,
  // The API (requests and event streams), PostHog, song files (cover thumbnails), and Vite's HMR socket in development.
  `connect-src 'self' ${MEDIA} ws://localhost:* ${API_ORIGIN} ${TUNEPERFECT} ${POSTHOG}`,
  `frame-src ${YOUTUBE_EMBED} https://www.youtube.com https://www.youtube-nocookie.com`,
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");
