import type { InferSelectModel } from "drizzle-orm";
import * as v from "valibot";
import type { clubInvites, clubMembers, clubs } from "../lib/db/schema";

export const ClubNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(20));
export const ClubMemberRoleSchema = v.union([v.literal("admin"), v.literal("member")]);

export type Club = InferSelectModel<typeof clubs>;
export type ClubMember = InferSelectModel<typeof clubMembers>;
export type ClubInvite = InferSelectModel<typeof clubInvites>;
