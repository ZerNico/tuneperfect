import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { highscores } from "../lib/db/schema";

export class HighscoreService {
  async setHighscore(hash: string, userId: string, score: number) {
    const [highscore] = await db
      .insert(schema.highscores)
      .values({ hash, userId, score })
      .onConflictDoUpdate({
        target: [schema.highscores.hash, schema.highscores.userId],
        set: { score },
        setWhere: sql`${score} > ${schema.highscores.score}`,
      })
      .returning();

    return highscore;
  }

  async getHighscoresForLobby(lobbyId: string, hash: string) {
    const scores = await db
      .select({
        ...getTableColumns(schema.highscores),
        user: schema.users,
      })
      .from(highscores)
      .innerJoin(schema.users, eq(highscores.userId, schema.users.id))
      .where(and(eq(highscores.hash, hash), eq(schema.users.lobbyId, lobbyId)))
      .orderBy(highscores.score);

    return scores;
  }
}

export const highscoreService = new HighscoreService();
