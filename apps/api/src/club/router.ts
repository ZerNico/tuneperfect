import { os } from "@orpc/server";
import * as v from "valibot";

import { requireUser } from "../auth/middleware";
import { base } from "../base";
import { UsernameSchema } from "../user/models";

import { ClubMemberRoleSchema, ClubNameSchema } from "./models";
import { clubService } from "./service";

export const clubRouter = os.prefix("/clubs").router({
  createClub: base
    .use(requireUser)
    .input(
      v.object({
        name: ClubNameSchema,
      }),
    )
    .handler(async ({ input, context }) => {
      const club = await clubService.createClub(input.name, context.payload.sub);

      return {
        clubId: club.id,
      };
    }),

  getClub: base
    .errors({
      NOT_FOUND: { status: 404 },
      FORBIDDEN: { status: 403 },
    })
    .use(requireUser)
    .input(v.object({ clubId: v.string() }))
    .handler(async ({ input, context, errors }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const isMember = club.members.some((member) => member.userId === context.payload.sub);

      if (!isMember) {
        throw errors.FORBIDDEN({ message: "You don't have permission to view this club" });
      }

      return club;
    }),

  updateClub: base
    .errors({
      NOT_FOUND: { status: 404 },
      FORBIDDEN: { status: 403 },
    })
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        name: ClubNameSchema,
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwnerOrAdmin(member)) {
        throw errors.FORBIDDEN({ message: "You don't have permission to update this club" });
      }

      const updatedClub = await clubService.updateClub(input.clubId, {
        name: input.name,
      });

      return updatedClub;
    }),

  getUserClubs: base.use(requireUser).handler(async ({ context }) => {
    return await clubService.getUserClubs(context.payload.sub);
  }),

  invite: base
    .errors({
      USER_NOT_FOUND: { status: 400 },
      CLUB_NOT_FOUND: { status: 400 },
      FORBIDDEN: { status: 403 },
      ALREADY_MEMBER: { status: 400 },
      ALREADY_INVITED: { status: 400 },
    })
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        username: UsernameSchema,
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const club = await clubService.getClub(input.clubId);
      if (!club) {
        throw errors.CLUB_NOT_FOUND({ message: "Club not found" });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwnerOrAdmin(member)) {
        throw errors.FORBIDDEN({ message: "You don't have permission to invite users to this club" });
      }

      try {
        await clubService.inviteUserToClub(input.clubId, context.payload.sub, input.username);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "User not found") {
            throw errors.USER_NOT_FOUND({ message: "User not found" });
          }
          if (error.message === "User is already a member of this club") {
            throw errors.ALREADY_MEMBER({ message: "User is already a member of this club" });
          }
          if (error.message === "User has a pending invite for this club") {
            throw errors.ALREADY_INVITED({ message: "User has a pending invite for this club" });
          }
        }
        throw error;
      }
    }),

  getUserInvites: base.use(requireUser).handler(async ({ context }) => {
    return await clubService.getUserInvites(context.payload.sub);
  }),

  acceptInvite: base
    .use(requireUser)
    .input(v.object({ clubId: v.string() }))
    .errors({
      NOT_FOUND: {
        status: 404,
      },
    })
    .handler(async ({ context, errors, input }) => {
      try {
        await clubService.acceptInvite(input.clubId, context.payload.sub);
      } catch (error) {
        if (error instanceof Error && error.message === "Invite not found") {
          throw errors.NOT_FOUND({ message: "Invite not found" });
        }
        throw error;
      }
    }),

  declineInvite: base
    .use(requireUser)
    .input(v.object({ clubId: v.string() }))
    .handler(async ({ context, input }) => {
      await clubService.declineInvite(input.clubId, context.payload.sub);
    }),

  removeMember: base
    .use(requireUser)
    .input(v.object({ clubId: v.string(), userId: v.string() }))
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);
      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwner(member)) {
        throw errors.FORBIDDEN({ message: "Only the club owner can remove members" });
      }

      const memberToRemove = club.members.find((m) => m.userId === input.userId);
      if (!memberToRemove) {
        throw errors.NOT_FOUND({ message: "Member not found in this club" });
      }

      if (clubService.isOwner(memberToRemove)) {
        throw errors.FORBIDDEN({ message: "Cannot remove the club owner" });
      }

      await clubService.removeMember(input.clubId, input.userId);
    }),

  transferOwnership: base
    .use(requireUser)
    .input(v.object({ clubId: v.string(), userId: v.string() }))
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
    })
    .handler(async ({ context, errors, input }) => {
      if (context.payload.sub === input.userId) {
        throw errors.FORBIDDEN({ message: "You cannot transfer ownership to yourself" });
      }

      const club = await clubService.getClub(input.clubId);
      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const currentOwner = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwner(currentOwner)) {
        throw errors.FORBIDDEN({ message: "Only the club owner can transfer ownership" });
      }

      const newOwner = club.members.find((m) => m.userId === input.userId);
      if (!newOwner) {
        throw errors.NOT_FOUND({ message: "New owner is not a member of this club" });
      }

      await clubService.transferOwnership(input.clubId, context.payload.sub, input.userId);
    }),

  leaveClub: base
    .use(requireUser)
    .input(v.object({ clubId: v.string() }))
    .errors({
      FORBIDDEN: {
        status: 403,
      },
      NOT_FOUND: {
        status: 404,
      },
    })
    .handler(async ({ context, errors, input }) => {
      try {
        await clubService.leaveClub(input.clubId, context.payload.sub);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "You are not a member of this club") {
            throw errors.NOT_FOUND({ message: "You are not a member of this club" });
          }
          if (error.message === "You must transfer ownership before leaving the club") {
            throw errors.FORBIDDEN({
              message: "You must transfer ownership before leaving the club",
            });
          }
        }
        throw error;
      }
    }),

  deleteClub: base
    .use(requireUser)
    .input(v.object({ clubId: v.string() }))
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);
      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwner(member)) {
        throw errors.FORBIDDEN({ message: "Only the club owner can delete the club" });
      }

      await clubService.deleteClub(input.clubId);
    }),

  changeRole: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        userId: v.string(),
        role: ClubMemberRoleSchema,
      }),
    )
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);
      if (!club) {
        throw errors.NOT_FOUND({ message: "Club not found" });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);
      if (!clubService.isOwner(member)) {
        throw errors.FORBIDDEN({
          message: "Only the club owner can change member roles",
        });
      }

      const memberToChange = club.members.find((m) => m.userId === input.userId);
      if (!memberToChange) {
        throw errors.NOT_FOUND({ message: "Member not found in this club" });
      }

      if (clubService.isOwner(memberToChange)) {
        throw errors.FORBIDDEN({ message: "Cannot change the club owner's role" });
      }

      await clubService.changeRole(input.clubId, input.userId, input.role);
    }),
});
