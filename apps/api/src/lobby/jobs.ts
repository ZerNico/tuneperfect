import { Cron } from "croner";
import { subDays } from "date-fns";
import { lt } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { logger } from "../lib/logger";

export function setupLobbyCleanupJob() {
  // Run every hour
  const job = new Cron("0 * * * *", async () => {
    try {
      const date = subDays(new Date(), 7);

      const result = await db
        .delete(schema.lobbies)
        .where(lt(schema.lobbies.createdAt, date))
        .returning({ id: schema.lobbies.id });

      if (result.length > 0) {
        logger.info(`Cleaned up ${result.length} expired lobbies: ${result.map((r) => r.id).join(", ")}`);
      } else {
        logger.info("No expired lobbies to clean up");
      }
    } catch (error) {
      logger.error(error, "Failed to clean up expired lobbies");
    }
  });

  logger.info(`Lobby cleanup job scheduled: ${job.nextRun()}`);

  return job;
}
