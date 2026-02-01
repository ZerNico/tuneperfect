// WebRTC transport layer - creates RTCPeerConnection and data channels.
// oRPC clients are created in the _connected route layout.

import {
  type ChannelTracker,
  createChannelTracker,
  createIceCandidateBuffer,
  createOrderedDataChannel,
  type IceCandidateBuffer,
  parseIceCandidate,
  processBufferedCandidates,
  serializeIceCandidate,
  setupDataChannelHandlers,
  WEBRTC_CONFIG,
} from "@tuneperfect/webrtc/utils";
import { iceServers } from "./ice-servers";

export interface GuestConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onChannelsReady: () => void;
  onChannelsClosed: () => void;
}

export interface GuestConnection {
  pc: RTCPeerConnection;
  gameRpcChannel: RTCDataChannel;
  appRpcChannel: RTCDataChannel;
  channelsReady: () => boolean;
  createOffer: () => Promise<string>;
  setAnswer: (answerSdp: string) => Promise<void>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
}

export function createGuestConnection(callbacks: GuestConnectionCallbacks): GuestConnection {
  const pc = new RTCPeerConnection({ iceServers });

  const iceBuffer: IceCandidateBuffer = createIceCandidateBuffer();

  let gameRpcChannelCleanup: (() => void) | null = null;
  let appRpcChannelCleanup: (() => void) | null = null;

  const channelTracker: ChannelTracker = createChannelTracker(
    [WEBRTC_CONFIG.channels.gameRpc, WEBRTC_CONFIG.channels.appRpc],
    () => callbacks.onChannelsReady(),
  );

  const gameRpcChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.gameRpc);

  const gameRpcSetup = setupDataChannelHandlers(gameRpcChannel, {
    onOpen: () => {
      channelTracker.markOpen(WEBRTC_CONFIG.channels.gameRpc);
    },
    onClose: () => {
      channelTracker.markClosed(WEBRTC_CONFIG.channels.gameRpc);
      callbacks.onChannelsClosed();
    },
    onError: (event) => {
      console.error("[WebRTC] game-rpc channel error:", event);
    },
  });
  gameRpcChannelCleanup = gameRpcSetup.cleanup;

  const appRpcChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.appRpc);

  const appRpcSetup = setupDataChannelHandlers(appRpcChannel, {
    onOpen: () => {
      channelTracker.markOpen(WEBRTC_CONFIG.channels.appRpc);
    },
    onClose: () => {
      channelTracker.markClosed(WEBRTC_CONFIG.channels.appRpc);
      callbacks.onChannelsClosed();
    },
    onError: (event) => {
      console.error("[WebRTC] app-rpc channel error:", event);
    },
  });
  appRpcChannelCleanup = appRpcSetup.cleanup;

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

  const createOffer = async (): Promise<string> => {
    const offer = await pc.createOffer();
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
      const iceCandidate = parseIceCandidate(immediateCandidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error("[WebRTC] Failed to add ICE candidate:", error);
    }
  };

  const close = (): void => {
    gameRpcChannelCleanup?.();
    gameRpcChannelCleanup = null;
    appRpcChannelCleanup?.();
    appRpcChannelCleanup = null;

    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    gameRpcChannel.close();
    appRpcChannel.close();
    pc.close();

    iceBuffer.clear();
    channelTracker.reset();
  };

  const channelsReady = () => channelTracker.allOpen;

  return {
    pc,
    gameRpcChannel,
    appRpcChannel,
    channelsReady,
    createOffer,
    setAnswer,
    addIceCandidate,
    close,
  };
}
