ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_username" text;--> statement-breakpoint
CREATE UNIQUE INDEX "email_unique_index" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "username_unique_index" ON "users" USING btree (lower("username"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");