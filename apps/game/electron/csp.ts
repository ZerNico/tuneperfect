/**
 * Content Security Policy for the packaged app, carried over from the Tauri config minus
 * Tauri's own `ipc:`/`asset:` sources. `localhost` covers the native media server, which
 * serves song files and the YouTube embed page.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self' http://localhost:* http://127.0.0.1:*",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com",
  // Solid sets some styles through the style attribute, and Vite injects CSS as <style>
  // tags in development. Inline styles can't run code, so allowing them costs little.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: http://localhost:* http://127.0.0.1:* https://*.tuneperfect.org https://*.tuneperfect.localhost https://*.googleusercontent.com https://cdn.discordapp.com https://usdb.animux.de",
  "media-src 'self' data: http://localhost:* http://127.0.0.1:*",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://eu.i.posthog.com https://eu-assets.i.posthog.com *",
  "frame-src http://localhost:* http://127.0.0.1:* https://www.youtube.com https://www.youtube-nocookie.com",
].join("; ");
