ALTER TABLE "club_invitations" RENAME TO "club_invites";--> statement-breakpoint
ALTER TABLE "club_invites" DROP CONSTRAINT "club_invitations_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "club_invites" DROP CONSTRAINT "club_invitations_inviter_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "club_invites" DROP CONSTRAINT "club_invitations_invitee_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "club_invites" DROP CONSTRAINT "club_invitations_club_id_invitee_id_pk";--> statement-breakpoint
ALTER TABLE "club_invites" ADD CONSTRAINT "club_invites_club_id_invitee_id_pk" PRIMARY KEY("club_id","invitee_id");--> statement-breakpoint
ALTER TABLE "club_invites" ADD CONSTRAINT "club_invites_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "club_invites" ADD CONSTRAINT "club_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "club_invites" ADD CONSTRAINT "club_invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;