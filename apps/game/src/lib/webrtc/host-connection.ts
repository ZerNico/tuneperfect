import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import type { AppClient } from "@tuneperfect/webrtc/contracts/app";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
import {
  type ChannelTracker,
  createChannelTracker,
  createIceCandidateBuffer,
  type IceCandidateBuffer,
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

export function createHostConnection(
  userId: string,
  iceServers: RTCIceServer[],
  callbacks: HostConnectionCallbacks,
): HostConnection {
  const pc = new RTCPeerConnection({ iceServers });

  let gameRpcChannel: RTCDataChannel | null = null;
  let appRpcChannel: RTCDataChannel | null = null;
  let appClient: AppClient | null = null;
  let appRpcLink: RPCLink<ClientContext> | null = null;
  let gameRpcHandlerCleanup: (() => void) | null = null;

  const iceBuffer: IceCandidateBuffer = createIceCandidateBuffer();

  let gameRpcChannelCleanup: (() => void) | null = null;
  let appRpcChannelCleanup: (() => void) | null = null;

  const channelTracker: ChannelTracker = createChannelTracker(
    [WEBRTC_CONFIG.channels.gameRpc, WEBRTC_CONFIG.channels.appRpc],
    () => callbacks.onDataChannelOpen(),
  );

  const handleDataChannel = (event: RTCDataChannelEvent) => {
    const channel = event.channel;

    if (channel.label === WEBRTC_CONFIG.channels.gameRpc) {
      gameRpcChannel = channel;

      const setup = setupDataChannelHandlers(channel, {
        onOpen: () => {
          const handler = new RPCHandler<GameRouterContext>(gameRouter);
          gameRpcHandlerCleanup = handler.upgrade(channel, { context: { userId } });
          channelTracker.markOpen(WEBRTC_CONFIG.channels.gameRpc);
        },
        onClose: () => {
          gameRpcHandlerCleanup?.();
          gameRpcHandlerCleanup = null;
          channelTracker.markClosed(WEBRTC_CONFIG.channels.gameRpc);
        },
        onError: (event) => {
          console.error(`[WebRTC] game-rpc channel error for user ${userId}:`, event);
        },
      });
      gameRpcChannelCleanup = setup.cleanup;
    } else if (channel.label === WEBRTC_CONFIG.channels.appRpc) {
      appRpcChannel = channel;

      const setup = setupDataChannelHandlers(channel, {
        onOpen: () => {
          appRpcLink = new RPCLink({ channel });
          appClient = createORPCClient(appRpcLink) as AppClient;
          channelTracker.markOpen(WEBRTC_CONFIG.channels.appRpc);
        },
        onClose: () => {
          appRpcLink?.close();
          appRpcLink = null;
          appClient = null;
          channelTracker.markClosed(WEBRTC_CONFIG.channels.appRpc);
        },
        onError: (event) => {
          console.error(`[WebRTC] app-rpc channel error for user ${userId}:`, event);
        },
      });
      appRpcChannelCleanup = setup.cleanup;
    }
  };

  pc.addEventListener("datachannel", handleDataChannel);

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

  const isDataChannelOpen = (): boolean => {
    return channelTracker.allOpen;
  };

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
      const iceCandidate = parseIceCandidate(immediateCandidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, error);
    }
  };

  const close = (): void => {
    appRpcLink?.close();
    appRpcLink = null;
    gameRpcHandlerCleanup?.();
    gameRpcHandlerCleanup = null;

    gameRpcChannelCleanup?.();
    gameRpcChannelCleanup = null;
    appRpcChannelCleanup?.();
    appRpcChannelCleanup = null;

    pc.removeEventListener("datachannel", handleDataChannel);
    pc.removeEventListener("icecandidate", handleIceCandidate);
    pc.removeEventListener("connectionstatechange", handleConnectionStateChange);

    if (gameRpcChannel) gameRpcChannel.close();
    if (appRpcChannel) appRpcChannel.close();
    pc.close();

    appClient = null;
    gameRpcChannel = null;
    appRpcChannel = null;
    iceBuffer.clear();
    channelTracker.reset();
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
