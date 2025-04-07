import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";
import { joinURL } from "ufo";

export const authClient = createAuthClient({
  baseURL: joinURL(import.meta.env.VITE_API_URL, "/api/v1.0/auth"),
  plugins: [usernameClient()],
});
