import { eventIterator, ORPCError, os } from "@orpc/server";
import { requireUser } from "../auth/middleware";
import { base } from "../base";
import { requireLobby, requireLobbyOrUser } from "../lobby/middleware";
import { userService } from "../user/service";
import { SendSignalInputSchema, SignalSchema } from "./models";
import { signalingPublisher } from "./publisher";

export const signalingRouter = os.prefix("/signaling").router({
  // Game client (host) subscribes to receive signals from mobile apps (guests)
  subscribeAsHost: base
    .use(requireLobby)
    .output(eventIterator(SignalSchema))
    .handler(async function* ({ context, signal }) {
      const lobbyId = context.payload.sub;
      const channel = `lobby:${lobbyId}:host`;

      for await (const event of signalingPublisher.subscribe(channel, { signal })) {
        yield event;
      }
    }),

  // Mobile app (guest) subscribes to receive signals from game client (host)
  subscribeAsGuest: base
    .use(requireUser)
    .output(eventIterator(SignalSchema))
    .handler(async function* ({ context, signal }) {
      const userId = context.payload.sub;

      // Get user's lobbyId
      const user = await userService.getUserById(userId);
      if (!user?.lobbyId) {
        throw new ORPCError("PRECONDITION_FAILED", { message: "User is not in a lobby" });
      }

      const channel = `lobby:${user.lobbyId}:guest:${userId}`;

      for await (const event of signalingPublisher.subscribe(channel, { signal })) {
        yield event;
      }
    }),

  // Send a signal (offer, answer, or ICE candidate)
  // Both host and guest use this endpoint
  sendSignal: base
    .use(requireLobbyOrUser)
    .input(SendSignalInputSchema)
    .handler(async ({ context, input }) => {
      const { signal, to } = input;

      if (context.type === "lobby") {
        // Host (game client) sending to guest (mobile app)
        const lobbyId = context.payload.sub;
        if (!to) {
          throw new ORPCError("BAD_REQUEST", { message: "Target user ID required when host sends signal" });
        }
        const channel = `lobby:${lobbyId}:guest:${to}`;
        signalingPublisher.publish(channel, signal);
      } else {
        // Guest (mobile app) sending to host (game client)
        const user = await userService.getUserById(context.payload.sub);
        if (!user?.lobbyId) {
          throw new ORPCError("PRECONDITION_FAILED", { message: "User is not in a lobby" });
        }
        const channel = `lobby:${user.lobbyId}:host`;
        // Override signal.from with the authenticated userId to prevent spoofing
        const authenticatedSignal = { ...signal, from: context.payload.sub };
        signalingPublisher.publish(channel, authenticatedSignal);
      }
    }),
});
