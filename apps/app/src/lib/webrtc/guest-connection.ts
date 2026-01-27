/**
 * WebRTC guest connection for the mobile app.
 * Uses two data channels:
 * - "game-rpc": App sends requests to game, receives responses (client channel)
 * - "app-rpc": App receives requests from game, sends responses (server channel)
 */

import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import type { GameClient } from "@tuneperfect/contracts/game";
import { RPCLink } from "@tuneperfect/orpc-webrtc/client";
import { RPCHandler } from "@tuneperfect/orpc-webrtc/server";
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

/**
 * Creates a WebRTC connection for the guest (mobile app) to connect to the host (game client).
 */
export function createGuestConnection(callbacks: GuestConnectionCallbacks): GuestConnection {
  const pc = new RTCPeerConnection({ iceServers });

  let pendingIceCandidates: string[] = [];
  let remoteDescriptionSet = false;
  let gameClient: GameClient | null = null;
  let gameRpcLink: RPCLink<ClientContext> | null = null;
  let appRpcHandlerCleanup: (() => void) | null = null;

  // Track which channels are open
  let gameRpcChannelOpen = false;
  let appRpcChannelOpen = false;

  const checkBothChannelsOpen = () => {
    if (gameRpcChannelOpen && appRpcChannelOpen) {
      callbacks.onDataChannelOpen();
    }
  };

  // Channel for calling game procedures (app → game)
  const gameRpcChannel = pc.createDataChannel("game-rpc", { ordered: true });

  const handleGameRpcOpen = () => {
    gameRpcLink = new RPCLink({ channel: gameRpcChannel });
    gameClient = createORPCClient(gameRpcLink) as GameClient;
    gameRpcChannelOpen = true;
    checkBothChannelsOpen();
  };

  const handleGameRpcClose = () => {
    // Clean up the link
    gameRpcLink?.close();
    gameRpcLink = null;
    gameClient = null;
    gameRpcChannelOpen = false;
  };

  const handleGameRpcError = (error: Event) => {
    console.error("[WebRTC] game-rpc channel error:", error);
  };

  gameRpcChannel.addEventListener("open", handleGameRpcOpen);
  gameRpcChannel.addEventListener("close", handleGameRpcClose);
  gameRpcChannel.addEventListener("error", handleGameRpcError);

  // Channel for receiving game requests (game → app)
  const appRpcChannel = pc.createDataChannel("app-rpc", { ordered: true });

  const handleAppRpcOpen = () => {
    const handler = new RPCHandler(appRouter);
    appRpcHandlerCleanup = handler.upgrade(appRpcChannel);
    appRpcChannelOpen = true;
    checkBothChannelsOpen();
  };

  const handleAppRpcClose = () => {
    // Clean up the handler
    appRpcHandlerCleanup?.();
    appRpcHandlerCleanup = null;
    appRpcChannelOpen = false;
  };

  const handleAppRpcError = (error: Event) => {
    console.error("[WebRTC] app-rpc channel error:", error);
  };

  appRpcChannel.addEventListener("open", handleAppRpcOpen);
  appRpcChannel.addEventListener("close", handleAppRpcClose);
  appRpcChannel.addEventListener("error", handleAppRpcError);

  // RTCPeerConnection event handlers
  const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
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

  const setAnswer = async (answerSdp: string) => {
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    remoteDescriptionSet = true;

    for (const candidate of pendingIceCandidates) {
      try {
        const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
        await pc.addIceCandidate(iceCandidate);
      } catch (error) {
        console.error("[WebRTC] Failed to add buffered ICE candidate:", error);
      }
    }
    pendingIceCandidates = [];
  };

  const addIceCandidate = async (candidate: string) => {
    if (!remoteDescriptionSet) {
      pendingIceCandidates.push(candidate);
      return;
    }

    try {
      const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error("[WebRTC] Failed to add ICE candidate:", error);
    }
  };

  const close = () => {
    // Clean up oRPC resources first
    gameRpcLink?.close();
    gameRpcLink = null;
    appRpcHandlerCleanup?.();
    appRpcHandlerCleanup = null;

    // Remove data channel event listeners
    gameRpcChannel.removeEventListener("open", handleGameRpcOpen);
    gameRpcChannel.removeEventListener("close", handleGameRpcClose);
    gameRpcChannel.removeEventListener("error", handleGameRpcError);
    appRpcChannel.removeEventListener("open", handleAppRpcOpen);
    appRpcChannel.removeEventListener("close", handleAppRpcClose);
    appRpcChannel.removeEventListener("error", handleAppRpcError);

    // Remove peer connection event listeners
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    // Close channels and connection
    gameRpcChannel.close();
    appRpcChannel.close();
    pc.close();

    // Reset state
    gameClient = null;
    pendingIceCandidates = [];
    remoteDescriptionSet = false;
    gameRpcChannelOpen = false;
    appRpcChannelOpen = false;
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
