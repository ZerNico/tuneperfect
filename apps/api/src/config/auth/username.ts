import type { BetterAuthClientPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { type AuthPluginSchema, type BetterAuthPlugin, createAuthMiddleware } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { db } from "../db";

function defaultUsernameValidator(username: string) {
  return /^[a-zA-Z0-9_.]+$/.test(username);
}

export const schema = {
  user: {
    fields: {
      username: {
        type: "string",
        required: false,
        sortable: true,
        unique: true,
        returned: true,
      },
    },
  },
} satisfies AuthPluginSchema;

export const username = () => {
  return {
    id: "username",
    schema,
    hooks: {
      before: [
        {
          matcher(context) {
            return context.path === "/sign-up/email" || context.path === "/update-user";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const username = ctx.body?.username;

            if (!username) {
              return;
            }

            if (username.length < 3) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: "username is too short",
              });
            }

            if (username.length > 32) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: "username is too long",
              });
            }

            if (!defaultUsernameValidator(username)) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: "username must contain only letters, numbers, underscores, and dots",
              });
            }

            const existingUser = await db.query.users.findFirst({
              where: {
                RAW: (table) => sql`LOWER(${table.username}) = ${username.toLowerCase()}`,
              },
            });

            if (existingUser) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                message: "username is already taken",
              });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
