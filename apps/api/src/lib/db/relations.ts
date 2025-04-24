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
  },
  refreshTokens: {
    users: r.one.users({
      from: r.refreshTokens.userId,
      to: r.users.id,
    }),
  },
  verificationTokens: {
    users: r.one.users({
      from: r.verificationTokens.userId,
      to: r.users.id,
    }),
  },
  oauthAccounts: {
    users: r.one.users({
      from: r.oauthAccounts.userId,
      to: r.users.id,
    }),
  },
}));
