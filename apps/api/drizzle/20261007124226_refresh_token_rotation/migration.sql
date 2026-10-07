ALTER TABLE "refresh_tokens" ADD COLUMN "previous_token" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
CREATE INDEX "refresh_tokens_previous_token_index" ON "refresh_tokens" ("previous_token");