import { type SQL, defineRelations, sql } from "drizzle-orm";
import { type AnyPgColumn, uniqueIndex } from "drizzle-orm/pg-core";
import * as p from "drizzle-orm/pg-core";

const timestampColumns = {
  createdAt: p
    .timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: p
    .timestamp("updated_at")
    .notNull()
    .$onUpdateFn(() => new Date()),
};

export const users = p.pgTable(
  "users",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    username: p.text("username").unique(),
    password: p.text("password").notNull(),
    email: p.text("email").notNull().unique(),
    emailVerified: p.boolean("email_verified").notNull().default(false),
    image: p.text("image"),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("email_unique_index").on(lower(table.email)),
    uniqueIndex("username_unique_index").on(lower(table.username)),
  ],
);

export const refreshTokens = p.pgTable("refresh_tokens", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  userId: p.uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  userAgent: p.text("user_agent").notNull(),
  token: p.text("token").notNull(),
  ...timestampColumns,
});

export const verificationTokens = p.pgTable("verification_tokens", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  userId: p.uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  type: p.text("type", { enum: ["email_verification", "password_reset"] }).notNull(),
  token: p.text("token").notNull(),
  expires: p.timestamp("expires").notNull(),
  ...timestampColumns,
});

export const oauthAccounts = p.pgTable(
  "oauth_accounts",
  {
    provider: p.text("provider").notNull(),
    providerAccountId: p.text("provider_account_id").notNull(),
    userId: p.uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    ...timestampColumns,
  },
  (table) => [p.primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}
