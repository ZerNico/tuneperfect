import {
  createIceCandidateBuffer,
  createOrderedDataChannel,
  parseIceCandidate,
  processBufferedCandidates,
  serializeIceCandidate,
  setupDataChannelHandlers,
  WEBRTC_CONFIG,
} from "@tuneperfect/webrtc/utils";

export interface GuestConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onChannelOpen: () => void;
  onChannelClose: () => void;
}

export interface GuestConnection {
  pc: RTCPeerConnection;
  gameRpcChannel: RTCDataChannel;
  /** For small, urgent calls, once the game serves it (see `GameLink`). Not waited for: older games ignore it. */
  gameControlChannel: RTCDataChannel;
  /** An offer for the game; with `iceRestart`, one that finds a new network path for this same connection. */
  createOffer: (options?: { iceRestart?: boolean }) => Promise<string>;
  setAnswer: (answerSdp: string) => Promise<void>;
  addIceCandidate: (candidate: string) => Promise<void>;
  /** Fresh STUN/TURN servers (TURN credentials expire) for the next ICE restart. */
  setIceServers: (iceServers: RTCIceServer[]) => void;
  close: () => void;
}

/** The phone's side of the connection to the game: it opens the data channels the game serves its calls on. */
export function createGuestConnection(
  iceServers: RTCIceServer[],
  callbacks: GuestConnectionCallbacks,
): GuestConnection {
  const pc = new RTCPeerConnection({ iceServers });
  const iceBuffer = createIceCandidateBuffer();

  const gameRpcChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.gameRpc);
  // Its own stream: ordered within itself (a press's down before its up), independent of the main one.
  const gameControlChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.gameControl);
  const channelSetup = setupDataChannelHandlers(gameRpcChannel, {
    onOpen: () => callbacks.onChannelOpen(),
    onClose: () => callbacks.onChannelClose(),
    onError: (event) => {
      console.error("[WebRTC] game-rpc channel error:", event);
    },
  });

  const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      callbacks.onIceCandidate(serializeIceCandidate(event.candidate));
    }
  };

  const handleConnectionStateChange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  pc.addEventListener("icecandidate", handleIceCandidate);
  pc.addEventListener("connectionstatechange", handleConnectionStateChange);

  const createOffer = async (options?: { iceRestart?: boolean }): Promise<string> => {
    const offer = await pc.createOffer({ iceRestart: options?.iceRestart ?? false });
    await pc.setLocalDescription(offer);
    if (!offer.sdp) {
      throw new Error("Failed to create offer SDP");
    }
    return offer.sdp;
  };

  const setAnswer = async (answerSdp: string): Promise<void> => {
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    iceBuffer.setRemoteDescriptionReady();

    await processBufferedCandidates(pc, iceBuffer, (candidate, error) => {
      console.error("[WebRTC] Failed to add buffered ICE candidate:", error, candidate);
    });
  };

  const addIceCandidate = async (candidate: string): Promise<void> => {
    const immediateCandidate = iceBuffer.addCandidate(candidate);
    if (immediateCandidate === null) return;

    try {
      await pc.addIceCandidate(parseIceCandidate(immediateCandidate));
    } catch (error) {
      console.error("[WebRTC] Failed to add ICE candidate:", error);
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
    channelSetup.cleanup();
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    gameRpcChannel.close();
    gameControlChannel.close();
    pc.close();
    iceBuffer.clear();
  };

  return { pc, gameRpcChannel, gameControlChannel, createOffer, setAnswer, addIceCandidate, setIceServers, close };
}
