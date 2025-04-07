import type { AuthPluginSchema, BetterAuthPlugin } from "better-auth/plugins";

export const schema = {
  user: {
    fields: {
      lobbyId: {
        type: "string",
        required: false,
        sortable: true,
        returned: true,
        input: false,
      },
    },
  },
} satisfies AuthPluginSchema;

export const lobby = () => {
  return {
    id: "lobby",
    schema,
  } satisfies BetterAuthPlugin;
};
