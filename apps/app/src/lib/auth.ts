import { lobbyClient, usernameClient } from "@tuneperfect/api/auth";
import { createAuthClient } from "better-auth/solid";
import { joinURL } from "ufo";

export const authClient = createAuthClient({
  baseURL: joinURL(import.meta.env.VITE_API_URL, "/api/v1.0/auth"),
  plugins: [usernameClient(), lobbyClient()],
});
