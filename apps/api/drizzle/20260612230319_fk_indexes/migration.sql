CREATE INDEX "club_invites_invitee_id_index" ON "club_invites" ("invitee_id");--> statement-breakpoint
CREATE INDEX "club_members_user_id_index" ON "club_members" ("user_id");--> statement-breakpoint
CREATE INDEX "lobbies_club_id_index" ON "lobbies" ("club_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_index" ON "refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "users_lobby_id_index" ON "users" ("lobby_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_id_index" ON "verification_tokens" ("user_id");