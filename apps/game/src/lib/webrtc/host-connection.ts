import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
import {
  createIceCandidateBuffer,
  parseIceCandidate,
  processBufferedCandidates,
  serializeIceCandidate,
  setupDataChannelHandlers,
  WEBRTC_CONFIG,
} from "@tuneperfect/webrtc/utils";

import { type GameRouterContext, gameRouter } from "./router";

export interface HostConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

export interface HostConnection {
  userId: string;
  /** The phone's connection attempt this answers (see the API's signaling models); absent for older phones. */
  session: string | undefined;
  /** Answers an offer: the first one, or a later one restarting ICE on this same connection. */
  createAnswer: (offerSdp: string) => Promise<string>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
}

/** The game's side of one phone's connection. The phone opens the data channel; the game serves its calls on it. */
export function createHostConnection(
  userId: string,
  session: string | undefined,
  iceServers: RTCIceServer[],
  callbacks: HostConnectionCallbacks,
): HostConnection {
  const pc = new RTCPeerConnection({ iceServers });
  const iceBuffer = createIceCandidateBuffer();

  let gameRpcChannel: RTCDataChannel | null = null;
  let gameRpcChannelCleanup: (() => void) | null = null;
  let gameRpcHandlerCleanup: (() => void) | null = null;

  const handleDataChannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;
    // Older phones also open an unused "app-rpc" channel; it closes with the connection.
    if (channel.label !== WEBRTC_CONFIG.channels.gameRpc) return;

    gameRpcChannel = channel;
    const setup = setupDataChannelHandlers(channel, {
      onOpen: () => {
        const handler = new RPCHandler<GameRouterContext>(gameRouter);
        gameRpcHandlerCleanup = handler.upgrade(channel, { context: { userId } });
      },
      onClose: () => {
        gameRpcHandlerCleanup?.();
        gameRpcHandlerCleanup = null;
      },
      onError: (event) => {
        console.error(`[WebRTC] game-rpc channel error for user ${userId}:`, event);
      },
    });
    gameRpcChannelCleanup = setup.cleanup;
  };

  const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      callbacks.onIceCandidate(serializeIceCandidate(event.candidate));
    }
  };

  const handleConnectionStateChange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  pc.addEventListener("datachannel", handleDataChannel);
  pc.addEventListener("icecandidate", handleIceCandidate);
  pc.addEventListener("connectionstatechange", handleConnectionStateChange);

  const createAnswer = async (offerSdp: string): Promise<string> => {
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
    iceBuffer.setRemoteDescriptionReady();

    await processBufferedCandidates(pc, iceBuffer, (candidate, error) => {
      console.error(`[WebRTC] Failed to add buffered ICE candidate for user ${userId}:`, error, candidate);
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (!answer.sdp) {
      throw new Error("Failed to create answer SDP");
    }
    return answer.sdp;
  };

  const addIceCandidate = async (candidate: string): Promise<void> => {
    const immediateCandidate = iceBuffer.addCandidate(candidate);
    if (immediateCandidate === null) return;

    try {
      await pc.addIceCandidate(parseIceCandidate(immediateCandidate));
    } catch (error) {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, error);
    }
  };

  const close = (): void => {
    gameRpcHandlerCleanup?.();
    gameRpcHandlerCleanup = null;
    gameRpcChannelCleanup?.();
    gameRpcChannelCleanup = null;

    pc.removeEventListener("datachannel", handleDataChannel);
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    gameRpcChannel?.close();
    gameRpcChannel = null;
    pc.close();
    iceBuffer.clear();
  };

  return { userId, session, createAnswer, addIceCandidate, close };
}
