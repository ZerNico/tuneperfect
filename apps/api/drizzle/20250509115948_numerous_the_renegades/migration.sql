CREATE TABLE "highscores" (
	"hash" varchar NOT NULL,
	"user_id" uuid,
	"score" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "highscores_hash_user_id_pk" PRIMARY KEY("hash","user_id")
);
--> statement-breakpoint
CREATE TABLE "lobbies" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "lobbies_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lobby_id" varchar;--> statement-breakpoint
ALTER TABLE "highscores" ADD CONSTRAINT "highscores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE cascade ON UPDATE cascade;