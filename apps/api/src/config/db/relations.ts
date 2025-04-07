import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";


export const relations = defineRelations(schema, (r) => ({
  lobbies: {
    users: r.many.users({
      from: r.lobbies.id,
      to: r.users.lobbyId,
    }),
  },
  users: {
    highscores: r.many.highscores({
      from: r.users.id,
      to: r.highscores.userId,
    }),
  },
  highscores: {
    user: r.one.users({
      from: r.highscores.userId,
      to: r.users.id,
    }),
  },
}));
