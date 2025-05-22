import { Cron } from "croner";
import { lt } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { logger } from "../lib/logger";

export function setupTokenCleanupJob() {
  // Run daily at 02:00 AM
  const job = new Cron("0 2 * * *", async () => {
    try {
      const now = new Date();
      
      const result = await db.delete(schema.refreshTokens)
        .where(lt(schema.refreshTokens.expires, now))
        .returning({ token: schema.refreshTokens.token });
      
      if (result.length > 0) {
        logger.info(`Cleaned up ${result.length} expired refresh tokens`);
      } else {
        logger.info("No expired refresh tokens to clean up");
      }

      const verificationResult = await db.delete(schema.verificationTokens)
        .where(lt(schema.verificationTokens.expires, now))
        .returning({ type: schema.verificationTokens.type });
      
      if (verificationResult.length > 0) {
        const emailCount = verificationResult.filter(r => r.type === "email_verification").length;
        const resetCount = verificationResult.filter(r => r.type === "password_reset").length;
        
        logger.info(`Cleaned up ${verificationResult.length} expired verification tokens (${emailCount} email, ${resetCount} password reset)`);
      } else {
        logger.info("No expired verification tokens to clean up");
      }
    } catch (error) {
      logger.error(error, "Failed to clean up expired tokens");
    }
  });
  
  logger.info(`Token cleanup job scheduled: ${job.nextRun()}`);
  
  return job;
} 