/**
 * WebRTC host connection for the game client.
 * Handles two data channels from each guest:
 * - "game-rpc": Game receives requests from app, sends responses (server channel)
 * - "app-rpc": Game sends requests to app, receives responses (client channel)
 */

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

  // Track which channels are open
  let gameRpcChannelOpen = false;
  let appRpcChannelOpen = false;

  const checkBothChannelsOpen = () => {
    if (gameRpcChannelOpen && appRpcChannelOpen) {
      callbacks.onDataChannelOpen();
    }
  };

  // Handle incoming data channels from guest
  pc.ondatachannel = (event) => {
    const channel = event.channel;

    if (channel.label === "game-rpc") {
      // This channel receives requests FROM the app, we handle them
      gameRpcChannel = channel;

      channel.onopen = () => {
        const handler = new RPCHandler(gameRouter);
        handler.upgrade(channel);
        gameRpcChannelOpen = true;
        checkBothChannelsOpen();
      };

      channel.onclose = () => {
        gameRpcChannelOpen = false;
      };

      channel.onerror = (event) => {
        console.error(`[WebRTC] game-rpc channel error for user ${userId}:`, event);
      };
    } else if (channel.label === "app-rpc") {
      // This channel sends requests TO the app, we use it as client
      appRpcChannel = channel;

      channel.onopen = () => {
        const link = new RPCLink({ channel });
        appClient = createORPCClient(link) as AppClient;
        appRpcChannelOpen = true;
        checkBothChannelsOpen();
      };

      channel.onclose = () => {
        appClient = null;
        appRpcChannelOpen = false;
      };

      channel.onerror = (event) => {
        console.error(`[WebRTC] app-rpc channel error for user ${userId}:`, event);
      };
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
    }
  };

  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  const isDataChannelOpen = (): boolean => {
    return gameRpcChannelOpen && appRpcChannelOpen;
  };

  const createAnswer = async (offerSdp: string): Promise<string> => {
    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (!answer.sdp) {
      throw new Error("Failed to create answer SDP");
    }
    return answer.sdp;
  };

  const addIceCandidate = async (candidate: string) => {
    try {
      const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, error);
    }
  };

  const close = () => {
    if (gameRpcChannel) gameRpcChannel.close();
    if (appRpcChannel) appRpcChannel.close();
    pc.close();
    appClient = null;
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
