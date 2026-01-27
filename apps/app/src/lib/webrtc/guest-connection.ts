/**
 * WebRTC guest connection for the mobile app.
 * Uses two data channels:
 * - "game-rpc": App sends requests to game, receives responses (client channel)
 * - "app-rpc": App receives requests from game, sends responses (server channel)
 */

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

  gameRpcChannel.onopen = () => {
    const link = new RPCLink({ channel: gameRpcChannel });
    gameClient = createORPCClient(link) as GameClient;
    gameRpcChannelOpen = true;
    checkBothChannelsOpen();
  };

  gameRpcChannel.onclose = () => {
    gameClient = null;
    gameRpcChannelOpen = false;
  };

  gameRpcChannel.onerror = (error) => {
    console.error("[WebRTC] game-rpc channel error:", error);
  };

  // Channel for receiving game requests (game → app)
  const appRpcChannel = pc.createDataChannel("app-rpc", { ordered: true });

  appRpcChannel.onopen = () => {
    const handler = new RPCHandler(appRouter);
    handler.upgrade(appRpcChannel);
    appRpcChannelOpen = true;
    checkBothChannelsOpen();
  };

  appRpcChannel.onclose = () => {
    appRpcChannelOpen = false;
  };

  appRpcChannel.onerror = (error) => {
    console.error("[WebRTC] app-rpc channel error:", error);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
    }
  };

  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

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
    gameRpcChannel.close();
    appRpcChannel.close();
    pc.close();
    gameClient = null;
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
