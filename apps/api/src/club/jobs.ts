import { Cron } from "croner";
import { and, eq, exists, inArray, not } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { logger } from "../lib/logger";

export function setupClubCleanupJob() {
  // Run every hour
  const job = new Cron("0 * * * *", async () => {
    try {
      // Find clubs that have no owner
      const orphanedClubs = await db
        .select({ id: schema.clubs.id })
        .from(schema.clubs)
        .where(
          not(
            exists(
              db
                .select()
                .from(schema.clubMembers)
                .where(and(eq(schema.clubMembers.clubId, schema.clubs.id), eq(schema.clubMembers.role, "owner"))),
            ),
          ),
        );

      if (orphanedClubs.length > 0) {
        // Delete the orphaned clubs
        const result = await db
          .delete(schema.clubs)
          .where(
            inArray(
              schema.clubs.id,
              orphanedClubs.map((c) => c.id),
            ),
          )
          .returning({ id: schema.clubs.id });

        logger.info(`Cleaned up ${result.length} orphaned clubs: ${result.map((r) => r.id).join(", ")}`);
      } else {
        logger.info("No orphaned clubs to clean up");
      }
    } catch (error) {
      logger.error(error, "Failed to clean up orphaned clubs");
    }
  });

  logger.info(`Club cleanup job scheduled: ${job.nextRun()}`);

  return job;
}
