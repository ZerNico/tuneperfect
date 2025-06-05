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
    clubMemberships: r.many.clubMembers({
      from: r.users.id,
      to: r.clubMembers.userId,
    }),
    receivedClubInvites: r.many.clubInvites({
      from: r.users.id,
      to: r.clubInvites.inviteeId,
    }),
    sentClubInvites: r.many.clubInvites({
      from: r.users.id,
      to: r.clubInvites.inviterId,
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
    selectedClub: r.one.clubs({
      from: r.lobbies.clubId,
      to: r.clubs.id,
    }),
  },
  highscores: {
    user: r.one.users({
      from: r.highscores.userId,
      to: r.users.id,
    }),
  },
  clubs: {
    members: r.many.clubMembers({
      from: r.clubs.id,
      to: r.clubMembers.clubId,
    }),
    invites: r.many.clubInvites({
      from: r.clubs.id,
      to: r.clubInvites.clubId,
    }),
    selectedByLobbies: r.many.lobbies({
      from: r.clubs.id,
      to: r.lobbies.clubId,
    }),
  },
  clubMembers: {
    club: r.one.clubs({
      from: r.clubMembers.clubId,
      to: r.clubs.id,
    }),
    user: r.one.users({
      from: r.clubMembers.userId,
      to: r.users.id,
    }),
  },
  clubInvites: {
    club: r.one.clubs({
      from: r.clubInvites.clubId,
      to: r.clubs.id,
    }),
    inviter: r.one.users({
      from: r.clubInvites.inviterId,
      to: r.users.id,
    }),
    invitee: r.one.users({
      from: r.clubInvites.inviteeId,
      to: r.users.id,
    }),
  },
}));
