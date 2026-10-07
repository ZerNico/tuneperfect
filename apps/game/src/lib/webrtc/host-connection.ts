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
  /** Fresh STUN/TURN servers (TURN credentials expire) for the next ICE restart. */
  setIceServers: (iceServers: RTCIceServer[]) => void;
  close: () => void;
}

/** The game's side of one phone's connection. The phone opens the data channels; the game serves its calls on them. */
export function createHostConnection(
  userId: string,
  session: string | undefined,
  iceServers: RTCIceServer[],
  callbacks: HostConnectionCallbacks,
): HostConnection {
  const pc = new RTCPeerConnection({ iceServers });
  const iceBuffer = createIceCandidateBuffer();

  /** The phone's channels the game serves its calls on, with what ends serving them. */
  const channels = new Map<RTCDataChannel, () => void>();
  const servedLabels: string[] = [WEBRTC_CONFIG.channels.gameRpc, WEBRTC_CONFIG.channels.gameControl];

  const handleDataChannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;
    // Older phones also open an unused "app-rpc" channel; it closes with the connection.
    if (!servedLabels.includes(channel.label)) return;

    let stopServing: (() => void) | null = null;
    const setup = setupDataChannelHandlers(channel, {
      onOpen: () => {
        const handler = new RPCHandler<GameRouterContext>(gameRouter);
        stopServing = handler.upgrade(channel, { context: { userId } });
      },
      onClose: () => {
        stopServing?.();
        stopServing = null;
      },
      onError: (event) => {
        console.error(`[WebRTC] ${channel.label} channel error for user ${userId}:`, event);
      },
    });
    channels.set(channel, () => {
      stopServing?.();
      setup.cleanup();
      channel.close();
    });
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

  // Only affects the next gathering (an ICE restart); the current path keeps its candidates.
  const setIceServers = (iceServers: RTCIceServer[]): void => {
    try {
      pc.setConfiguration({ ...pc.getConfiguration(), iceServers });
    } catch (error) {
      console.warn("[WebRTC] Kept the old ICE servers:", error);
    }
  };

  const close = (): void => {
    for (const end of channels.values()) end();
    channels.clear();

    pc.removeEventListener("datachannel", handleDataChannel);
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    pc.close();
    iceBuffer.clear();
  };

  return { userId, session, createAnswer, addIceCandidate, setIceServers, close };
}
