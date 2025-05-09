ALTER TABLE "users" DROP CONSTRAINT "users_lobby_id_lobbies_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE set null ON UPDATE cascade;