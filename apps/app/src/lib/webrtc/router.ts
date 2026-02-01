import { implement } from "@orpc/server";
import { appContract } from "@tuneperfect/webrtc/contracts/app";

const os = implement(appContract);

// Currently empty - reserved for future bidirectional communication
export const appRouter = os.router({});
