/**
 * WebRTC host connection for the game client.
 * Handles two data channels from each guest:
 * - "game-rpc": Game receives requests from app, sends responses (server channel)
 * - "app-rpc": Game sends requests to app, receives responses (client channel)
 */

import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import type { AppClient } from "@tuneperfect/contracts/app";
import { RPCLink } from "@tuneperfect/orpc-webrtc/client";
import { RPCHandler } from "@tuneperfect/orpc-webrtc/server";
import { iceServers } from "./ice-servers";
import { gameRouter } from "./router";

export interface HostConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen: () => void;
}

export type { AppClient };

export interface HostConnection {
  pc: RTCPeerConnection;
  userId: string;
  createAnswer: (offerSdp: string) => Promise<string>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
  isDataChannelOpen: () => boolean;
  getAppClient: () => AppClient | null;
}

/**
 * Creates a WebRTC connection for the host (game client) to a specific guest.
 */
export function createHostConnection(userId: string, callbacks: HostConnectionCallbacks): HostConnection {
  const pc = new RTCPeerConnection({ iceServers });

  let gameRpcChannel: RTCDataChannel | null = null;
  let appRpcChannel: RTCDataChannel | null = null;
  let appClient: AppClient | null = null;
  let appRpcLink: RPCLink<ClientContext> | null = null;
  let gameRpcHandlerCleanup: (() => void) | null = null;

  // ICE candidate buffering - buffer candidates until remote description is set
  let pendingIceCandidates: string[] = [];
  let remoteDescriptionSet = false;

  // Track which channels are open
  let gameRpcChannelOpen = false;
  let appRpcChannelOpen = false;

  const checkBothChannelsOpen = () => {
    if (gameRpcChannelOpen && appRpcChannelOpen) {
      callbacks.onDataChannelOpen();
    }
  };

  // Handle incoming data channels from guest
  const handleDataChannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;

    if (channel.label === "game-rpc") {
      // This channel receives requests FROM the app, we handle them
      gameRpcChannel = channel;

      const handleOpen = () => {
        const handler = new RPCHandler(gameRouter);
        gameRpcHandlerCleanup = handler.upgrade(channel);
        gameRpcChannelOpen = true;
        checkBothChannelsOpen();
      };

      const handleClose = () => {
        gameRpcHandlerCleanup?.();
        gameRpcHandlerCleanup = null;
        gameRpcChannelOpen = false;
      };

      const handleError = (event: Event) => {
        console.error(`[WebRTC] game-rpc channel error for user ${userId}:`, event);
      };

      channel.addEventListener("open", handleOpen);
      channel.addEventListener("close", handleClose);
      channel.addEventListener("error", handleError);
    } else if (channel.label === "app-rpc") {
      // This channel sends requests TO the app, we use it as client
      appRpcChannel = channel;

      const handleOpen = () => {
        appRpcLink = new RPCLink({ channel });
        appClient = createORPCClient(appRpcLink) as AppClient;
        appRpcChannelOpen = true;
        checkBothChannelsOpen();
      };

      const handleClose = () => {
        appRpcLink?.close();
        appRpcLink = null;
        appClient = null;
        appRpcChannelOpen = false;
      };

      const handleError = (event: Event) => {
        console.error(`[WebRTC] app-rpc channel error for user ${userId}:`, event);
      };

      channel.addEventListener("open", handleOpen);
      channel.addEventListener("close", handleClose);
      channel.addEventListener("error", handleError);
    }
  };

  pc.addEventListener("datachannel", handleDataChannel);

  // ICE candidate handler
  const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
    }
  };

  pc.addEventListener("icecandidate", handleIceCandidate);

  // Connection state change handler
  const handleConnectionStateChange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  pc.addEventListener("connectionstatechange", handleConnectionStateChange);

  const isDataChannelOpen = (): boolean => {
    return gameRpcChannelOpen && appRpcChannelOpen;
  };

  const createAnswer = async (offerSdp: string): Promise<string> => {
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
    remoteDescriptionSet = true;

    // Process any buffered ICE candidates
    for (const candidate of pendingIceCandidates) {
      try {
        const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
        await pc.addIceCandidate(iceCandidate);
      } catch (error) {
        console.error(`[WebRTC] Failed to add buffered ICE candidate for user ${userId}:`, error);
      }
    }
    pendingIceCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (!answer.sdp) {
      throw new Error("Failed to create answer SDP");
    }
    return answer.sdp;
  };

  const addIceCandidate = async (candidate: string) => {
    // Buffer candidates until remote description is set
    if (!remoteDescriptionSet) {
      pendingIceCandidates.push(candidate);
      return;
    }

    try {
      const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, error);
    }
  };

  const close = () => {
    // Clean up oRPC resources
    appRpcLink?.close();
    appRpcLink = null;
    gameRpcHandlerCleanup?.();
    gameRpcHandlerCleanup = null;

    // Remove peer connection event listeners
    pc.removeEventListener("datachannel", handleDataChannel);
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    // Close channels (their event listeners are removed when the channel is closed or garbage collected)
    if (gameRpcChannel) gameRpcChannel.close();
    if (appRpcChannel) appRpcChannel.close();
    pc.close();

    // Reset state
    appClient = null;
    gameRpcChannel = null;
    appRpcChannel = null;
    pendingIceCandidates = [];
    remoteDescriptionSet = false;
    gameRpcChannelOpen = false;
    appRpcChannelOpen = false;
  };

  const getAppClient = (): AppClient | null => appClient;

  return {
    pc,
    userId,
    createAnswer,
    addIceCandidate,
    close,
    isDataChannelOpen,
    getAppClient,
  };
}
