ALTER TABLE "highscores" DROP CONSTRAINT "highscores_hash_user_id_pk";--> statement-breakpoint
ALTER TABLE "highscores" ADD COLUMN "difficulty" text DEFAULT 'easy' NOT NULL;--> statement-breakpoint
ALTER TABLE "highscores" ADD CONSTRAINT "highscores_hash_user_id_difficulty_pk" PRIMARY KEY("hash","user_id","difficulty");