import { Cron } from "croner";
import { subDays } from "date-fns";
import { lt } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { logger } from "../lib/logger";

export class CleanupService {
  private lobbiesCleanupJob: Cron;

  constructor() {
    // Run every day at 3:00 AM
    this.lobbiesCleanupJob = new Cron("0 3 * * *", () => {
      this.cleanupExpiredLobbies();
    });
    
    logger.info("Initialized cleanup jobs");
  }

  async cleanupExpiredLobbies() {
    try {
      // Lobbies expire after 7 days
      const expirationDate = subDays(new Date(), 7);
      
      // First, remove lobby associations from users in expired lobbies
      await db
        .update(schema.users)
        .set({ lobbyId: null })
        .where(
          lt(schema.lobbies.createdAt, expirationDate)
        );
      
      // Then, delete the expired lobbies
      const result = await db
        .delete(schema.lobbies)
        .where(
          lt(schema.lobbies.createdAt, expirationDate)
        )
        .returning({ id: schema.lobbies.id });
      
      if (result.length > 0) {
        logger.info(`Cleaned up ${result.length} expired lobbies`);
      }
    } catch (error) {
      logger.error({ error }, "Failed to clean up expired lobbies");
    }
  }

  // Method to manually trigger cleanup (useful for testing)
  async triggerCleanup() {
    await this.cleanupExpiredLobbies();
  }
}

export const cleanupService = new CleanupService(); 