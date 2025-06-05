import { os } from "@orpc/server";
import * as v from "valibot";
import { requireUser } from "../auth/middleware";
import { base } from "../base";
import { tryCatch } from "../utils/try-catch";
import { clubService } from "./service";

export const clubRouter = os.prefix("/clubs").router({
  createClub: base
    .use(requireUser)
    .input(
      v.object({
        name: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
      }),
    )
    .handler(async ({ context, input }) => {
      const club = await clubService.createClub(input.name, context.payload.sub);

      return {
        clubId: club.id,
      };
    }),

  getClub: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
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
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const isMember = club.members.some((member) => member.userId === context.payload.sub);

      if (!isMember) {
        throw errors.FORBIDDEN({
          message: "You don't have permission to view this club",
        });
      }

      return club;
    }),

  updateClub: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        name: v.string(),
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
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);

      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw errors.FORBIDDEN({
          message: "You don't have permission to update this club",
        });
      }

      const updatedClub = await clubService.updateClub(input.clubId, {
        name: input.name,
      });

      return updatedClub;
    }),

  getUserClubs: base.use(requireUser).handler(async ({ context }) => {
    const clubs = await clubService.getUserClubs(context.payload.sub);
    return clubs;
  }),

  invite: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        username: v.string(),
      }),
    )
    .errors({
      USER_NOT_FOUND: {
        status: 400,
      },
      CLUB_NOT_FOUND: {
        status: 400,
      },
      FORBIDDEN: {
        status: 403,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.CLUB_NOT_FOUND({
          message: "Club not found",
        });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);

      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw errors.FORBIDDEN({
          message: "You don't have permission to invite users to this club",
        });
      }

      const [error, _data] = await tryCatch(
        clubService.inviteUserToClub(input.clubId, context.payload.sub, input.username),
      );

      if (error) {
        if (error instanceof Error && error.message === "User not found") {
          throw errors.USER_NOT_FOUND({
            message: "User not found",
          });
        }
        throw error;
      }
    }),

  getUserInvites: base.use(requireUser).handler(async ({ context }) => {
    const invites = await clubService.getUserInvites(context.payload.sub);
    return invites;
  }),

  acceptInvite: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
      }),
    )
    .errors({
      BAD_REQUEST: {
        status: 400,
      },
    })
    .handler(async ({ context, errors, input }) => {
      await clubService.acceptInvite(input.clubId, context.payload.sub);
    }),

  declineInvite: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
      }),
    )
    .errors({
      BAD_REQUEST: {
        status: 400,
      },
    })
    .handler(async ({ context, errors, input }) => {
      await clubService.declineInvite(input.clubId, context.payload.sub);
    }),

  removeMember: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        userId: v.string(),
      }),
    )
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
      BAD_REQUEST: {
        status: 400,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const currentMember = club.members.find((m) => m.userId === context.payload.sub);

      if (!currentMember || currentMember.role !== "owner") {
        throw errors.FORBIDDEN({
          message: "Only the club owner can remove members",
        });
      }

      const memberToRemove = club.members.find((m) => m.userId === input.userId);

      if (!memberToRemove) {
        throw errors.NOT_FOUND({
          message: "Member not found in this club",
        });
      }

      if (memberToRemove.role === "owner") {
        throw errors.FORBIDDEN({
          message: "Cannot remove the club owner",
        });
      }

      await clubService.removeMember(input.clubId, input.userId);
    }),

  transferOwnership: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        userId: v.string(),
      }),
    )
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
      BAD_REQUEST: {
        status: 400,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);

      if (!member || member.role !== "owner") {
        throw errors.FORBIDDEN({
          message: "Only the club owner can transfer ownership",
        });
      }

      await clubService.transferOwnership(input.clubId, input.userId);
    }),

  leaveClub: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
      }),
    )
    .errors({
      BAD_REQUEST: {
        status: 400,
      },
      NOT_FOUND: {
        status: 404,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      try {
        await clubService.leaveClub(input.clubId, context.payload.sub);
      } catch (error) {
        if (error instanceof Error && error.message === "Transfer ownership first.") {
          throw errors.BAD_REQUEST({
            message: error.message,
          });
        }

        throw error;
      }
    }),

  deleteClub: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
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
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const member = club.members.find((m) => m.userId === context.payload.sub);

      if (!member || member.role !== "owner") {
        throw errors.FORBIDDEN({
          message: "Only the club owner can delete the club",
        });
      }

      await clubService.deleteClub(input.clubId);
    }),

  changeRole: base
    .use(requireUser)
    .input(
      v.object({
        clubId: v.string(),
        userId: v.string(),
        role: v.union([v.literal("admin"), v.literal("member")]),
      }),
    )
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      FORBIDDEN: {
        status: 403,
      },
      BAD_REQUEST: {
        status: 400,
      },
    })
    .handler(async ({ context, errors, input }) => {
      const club = await clubService.getClub(input.clubId);

      if (!club) {
        throw errors.NOT_FOUND({
          message: "Club not found",
        });
      }

      const currentMember = club.members.find((m) => m.userId === context.payload.sub);
      const targetMember = club.members.find((m) => m.userId === input.userId);

      if (!currentMember || !targetMember) {
        throw errors.NOT_FOUND({
          message: "Member not found",
        });
      }

      // Only owner can remove admin status
      if (targetMember.role === "admin" && input.role === "member" && currentMember.role !== "owner") {
        throw errors.FORBIDDEN({
          message: "Only the club owner can remove admin status",
        });
      }

      // Only owner or admin can promote to admin
      if (input.role === "admin" && currentMember.role !== "owner" && currentMember.role !== "admin") {
        throw errors.FORBIDDEN({
          message: "Only owners and admins can promote members to admin",
        });
      }

      await clubService.changeRole(input.clubId, input.userId, input.role);
    }),
});
