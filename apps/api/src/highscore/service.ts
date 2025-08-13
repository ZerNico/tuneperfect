import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { highscores } from "../lib/db/schema";

export class HighscoreService {
  async setHighscore(hash: string, userId: string, score: number, difficulty: "easy" | "medium" | "hard" = "easy") {
    const [highscore] = await db
      .insert(schema.highscores)
      .values({ hash, userId, score, difficulty })
      .onConflictDoUpdate({
        target: [schema.highscores.hash, schema.highscores.userId, schema.highscores.difficulty],
        set: { score },
        setWhere: sql`${score} > ${schema.highscores.score}`,
      })
      .returning();

    return highscore;
  }

  async getHighscoresForLobby(lobbyId: string, hash: string, difficulty?: "easy" | "medium" | "hard") {
    const lobby = await db.query.lobbies.findFirst({
      where: {
        id: lobbyId,
      },
      with: {
        users: true,
        selectedClub: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!lobby) {
      return [];
    }

    // Collect all user IDs (lobby users + club members if a club is selected)
    const userIds = new Set(lobby.users.map((user) => user.id));

    if (lobby.selectedClub) {
      for (const member of lobby.selectedClub.members) {
        userIds.add(member.userId);
      }
    }

    if (userIds.size === 0) {
      return [];
    }

    const userIdArray = Array.from(userIds);

    const whereConditions = [
      eq(highscores.hash, hash),
      inArray(schema.users.id, userIdArray)
    ];

    if (difficulty) {
      whereConditions.push(eq(highscores.difficulty, difficulty));
    }

    const scores = await db
      .select({
        ...getTableColumns(schema.highscores),
        user: schema.users,
      })
      .from(highscores)
      .innerJoin(schema.users, eq(highscores.userId, schema.users.id))
      .where(and(...whereConditions))
      .orderBy(highscores.score);

    return scores;
  }
}

export const highscoreService = new HighscoreService();
