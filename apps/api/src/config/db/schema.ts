import { type SQL, defineRelations, sql } from "drizzle-orm";
import { type AnyPgColumn, uniqueIndex } from "drizzle-orm/pg-core";
import * as p from "drizzle-orm/pg-core";

const timestampColumns = {
  createdAt: p.timestamp("created_at").notNull().defaultNow(),
  updatedAt: p
    .timestamp("updated_at")
    .notNull()
    .$onUpdateFn(() => new Date()),
};

export const users = p.pgTable(
  "users",
  {
    id: p.text("id").primaryKey(),
    name: p.text("name").notNull(),
    username: p.text("username").unique(),
    email: p.text("email").notNull().unique(),
    emailVerified: p.boolean("email_verified").notNull(),
    image: p.text("image"),
    lobbyId: p.varchar("lobby_id", { length: 8 }).references(() => lobbies.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("email_unique_index").on(lower(table.email)),
    uniqueIndex("username_unique_index").on(lower(table.username)),
  ],
);

export const sessions = p.pgTable("sessions", {
  id: p.text("id").primaryKey(),
  expiresAt: p.timestamp("expires_at").notNull(),
  token: p.text("token").notNull().unique(),
  ipAddress: p.text("ip_address"),
  userAgent: p.text("user_agent"),
  userId: p
    .text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestampColumns,
});

export const accounts = p.pgTable("accounts", {
  id: p.text("id").primaryKey(),
  accountId: p.text("account_id").notNull(),
  providerId: p.text("provider_id").notNull(),
  userId: p
    .text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: p.text("access_token"),
  refreshToken: p.text("refresh_token"),
  idToken: p.text("id_token"),
  accessTokenExpiresAt: p.timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: p.timestamp("refresh_token_expires_at"),
  scope: p.text("scope"),
  password: p.text("password"),
  ...timestampColumns,
});

export const verifications = p.pgTable("verifications", {
  id: p.text("id").primaryKey(),
  identifier: p.text("identifier").notNull(),
  value: p.text("value").notNull(),
  expiresAt: p.timestamp("expires_at").notNull(),
  ...timestampColumns,
});

export const lobbies = p.pgTable(
  "lobbies",
  {
    id: p.varchar({ length: 8 }).primaryKey().unique(),
    ...timestampColumns,
  },
  (table) => [uniqueIndex("id_unique_index").on(table.id)],
);

export const highscores = p.pgTable(
  "highscores",
  {
    hash: p.text("hash").notNull(),
    userId: p
      .text("user_id")
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    score: p.integer("score").notNull(),
    ...timestampColumns,
  },
  (table) => [p.primaryKey({ columns: [table.hash, table.userId] })],
);

export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}
