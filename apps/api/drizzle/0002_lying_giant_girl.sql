ALTER TABLE "highscores" ADD CONSTRAINT "highscores_hash_user_id_pk" PRIMARY KEY("hash","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "id_unique_index" ON "lobbies" USING btree ("id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "display_username";--> statement-breakpoint
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_id_unique" UNIQUE("id");