import type { InferSelectModel } from "drizzle-orm";
import type { clubInvites, clubMembers, clubs } from "../lib/db/schema";

export type Club = InferSelectModel<typeof clubs>;
export type ClubMember = InferSelectModel<typeof clubMembers>;
export type ClubInvite = InferSelectModel<typeof clubInvites>;
