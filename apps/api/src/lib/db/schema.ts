import { uniqueIndex } from "drizzle-orm/pg-core";
import * as p from "drizzle-orm/pg-core";
import { lower } from "../../utils/db";

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
    password: p.text("password"),
    email: p.text("email").notNull().unique(),
    emailVerified: p.boolean("email_verified").notNull().default(false),
    image: p.text("image"),
    lobbyId: p.varchar("lobby_id").references(() => lobbies.id, {
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

export const refreshTokens = p.pgTable("refresh_tokens", {
  token: p.text("token").primaryKey(),
  userId: p
    .uuid("user_id")
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  userAgent: p.text("user_agent").notNull(),
  expires: p.timestamp("expires").notNull(),
  ...timestampColumns,
});

export const verificationTokens = p.pgTable("verification_tokens", {
  token: p.text("token").primaryKey(),
  userId: p
    .uuid("user_id")
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  type: p.text("type", { enum: ["email_verification", "password_reset"] }).notNull(),
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

export const lobbies = p.pgTable("lobbies", {
  id: p.varchar("id").primaryKey().unique(),
  clubId: p.uuid("club_id").references(() => clubs.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  ...timestampColumns,
});

export const highscores = p.pgTable(
  "highscores",
  {
    hash: p.varchar("hash").notNull(),
    userId: p.uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    score: p.integer("score").notNull(),
    ...timestampColumns,
  },
  (table) => [p.primaryKey({ columns: [table.hash, table.userId] })],
);

export const clubs = p.pgTable("clubs", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name", { length: 255 }).notNull(),
  ...timestampColumns,
});

export const clubMembers = p.pgTable(
  "club_members",
  {
    clubId: p
      .uuid("club_id")
      .notNull()
      .references(() => clubs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: p
      .text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    ...timestampColumns,
  },
  (table) => [p.primaryKey({ columns: [table.clubId, table.userId] })],
);

export const clubInvites = p.pgTable(
  "club_invites",
  {
    clubId: p
      .uuid("club_id")
      .notNull()
      .references(() => clubs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    inviterId: p
      .uuid("inviter_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    inviteeId: p
      .uuid("invitee_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...timestampColumns,
  },
  (table) => [p.primaryKey({ columns: [table.clubId, table.inviteeId] })],
);
