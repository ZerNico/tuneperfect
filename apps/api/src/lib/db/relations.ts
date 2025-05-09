import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    refreshTokens: r.many.refreshTokens({
      from: r.users.id,
      to: r.refreshTokens.userId,
    }),
    verificationTokens: r.many.verificationTokens({
      from: r.users.id,
      to: r.verificationTokens.userId,
    }),
    oauthAccounts: r.many.oauthAccounts({
      from: r.users.id,
      to: r.oauthAccounts.userId,
    }),
    lobbies: r.one.lobbies({
      from: r.users.lobbyId,
      to: r.lobbies.id,
    }),
    highscores: r.many.highscores({
      from: r.users.id,
      to: r.highscores.userId,
    }),
  },
  refreshTokens: {
    user: r.one.users({
      from: r.refreshTokens.userId,
      to: r.users.id,
    }),
  },
  verificationTokens: {
    user: r.one.users({
      from: r.verificationTokens.userId,
      to: r.users.id,
    }),
  },
  oauthAccounts: {
    user: r.one.users({
      from: r.oauthAccounts.userId,
      to: r.users.id,
    }),
  },
  lobbies: {
    users: r.many.users({
      from: r.lobbies.id,
      to: r.users.lobbyId,
    }),
  },
  highscores: {
    user: r.one.users({
      from: r.highscores.userId,
      to: r.users.id,
    }),
  },
}));
