import type { BetterAuthClientPlugin } from "better-auth";
import type { lobby } from "./lobby";
import type { username } from "./username";
export const usernameClient = () => {
  return {
    id: "username",
    $InferServerPlugin: {} as ReturnType<typeof username>,
  } satisfies BetterAuthClientPlugin;
};

export const lobbyClient = () => {
  return {
    id: "lobby",
    $InferServerPlugin: {} as ReturnType<typeof lobby>,
  } satisfies BetterAuthClientPlugin;
};
