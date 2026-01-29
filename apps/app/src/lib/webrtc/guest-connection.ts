// WebRTC guest connection for the mobile app.
// Uses two data channels:
// - "game-rpc": App sends requests to game (client channel)
// - "app-rpc": App receives requests from game (server channel)

import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
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
import { appRouter } from "./router";

export interface GuestConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen: () => void;
}

export type { GameClient };

export interface GuestConnection {
  pc: RTCPeerConnection;
  createOffer: () => Promise<string>;
  setAnswer: (answerSdp: string) => Promise<void>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
  getGameClient: () => GameClient | null;
}

export function createGuestConnection(callbacks: GuestConnectionCallbacks): GuestConnection {
  const pc = new RTCPeerConnection({ iceServers });

  const iceBuffer: IceCandidateBuffer = createIceCandidateBuffer();

  let gameClient: GameClient | null = null;
  let gameRpcLink: RPCLink<ClientContext> | null = null;
  let appRpcHandlerCleanup: (() => void) | null = null;
  let gameRpcChannelCleanup: (() => void) | null = null;
  let appRpcChannelCleanup: (() => void) | null = null;

  const channelTracker: ChannelTracker = createChannelTracker(
    [WEBRTC_CONFIG.channels.gameRpc, WEBRTC_CONFIG.channels.appRpc],
    () => callbacks.onDataChannelOpen(),
  );

  const gameRpcChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.gameRpc);

  const gameRpcSetup = setupDataChannelHandlers(gameRpcChannel, {
    onOpen: () => {
      gameRpcLink = new RPCLink({ channel: gameRpcChannel });
      gameClient = createORPCClient(gameRpcLink) as GameClient;
      channelTracker.markOpen(WEBRTC_CONFIG.channels.gameRpc);
    },
    onClose: () => {
      gameRpcLink?.close();
      gameRpcLink = null;
      gameClient = null;
      channelTracker.markClosed(WEBRTC_CONFIG.channels.gameRpc);
    },
    onError: (event) => {
      console.error("[WebRTC] game-rpc channel error:", event);
    },
  });
  gameRpcChannelCleanup = gameRpcSetup.cleanup;

  const appRpcChannel = createOrderedDataChannel(pc, WEBRTC_CONFIG.channels.appRpc);

  const appRpcSetup = setupDataChannelHandlers(appRpcChannel, {
    onOpen: () => {
      const handler = new RPCHandler(appRouter);
      appRpcHandlerCleanup = handler.upgrade(appRpcChannel);
      channelTracker.markOpen(WEBRTC_CONFIG.channels.appRpc);
    },
    onClose: () => {
      appRpcHandlerCleanup?.();
      appRpcHandlerCleanup = null;
      channelTracker.markClosed(WEBRTC_CONFIG.channels.appRpc);
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
    gameRpcLink?.close();
    gameRpcLink = null;
    appRpcHandlerCleanup?.();
    appRpcHandlerCleanup = null;

    gameRpcChannelCleanup?.();
    gameRpcChannelCleanup = null;
    appRpcChannelCleanup?.();
    appRpcChannelCleanup = null;

    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    gameRpcChannel.close();
    appRpcChannel.close();
    pc.close();

    gameClient = null;
    iceBuffer.clear();
    channelTracker.reset();
  };

  const getGameClient = (): GameClient | null => gameClient;

  return {
    pc,
    createOffer,
    setAnswer,
    addIceCandidate,
    close,
    getGameClient,
  };
}
