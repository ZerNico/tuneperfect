import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppClient } from "@tuneperfect/webrtc/contracts/app";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
import { type ChannelTracker, createChannelTracker, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { commands, type IceServerConfig } from "~/bindings";
import { type GameRouterContext, gameRouter } from "./router";
import { RustDataChannel } from "./rust-data-channel";

export interface HostConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen: () => void;
}

export type { AppClient };

export interface HostConnection {
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
  let gameRpcChannel: RustDataChannel | null = null;
  let appRpcChannel: RustDataChannel | null = null;
  let appClient: AppClient | null = null;
  let appRpcLink: RPCLink<ClientContext> | null = null;
  let gameRpcHandlerCleanup: (() => void) | null = null;
  let gameRpcChannelCleanup: (() => void) | null = null;
  let appRpcChannelCleanup: (() => void) | null = null;
  let closed = false;

  const unlisteners: UnlistenFn[] = [];

  const channelTracker: ChannelTracker = createChannelTracker(
    [WEBRTC_CONFIG.channels.gameRpc, WEBRTC_CONFIG.channels.appRpc],
    () => callbacks.onDataChannelOpen(),
  );

  const setupEventListeners = async () => {
    const unlistenIce = await listen<{ userId: string; candidate: string }>("webrtc://ice-candidate", (event) => {
      if (!closed && event.payload.userId === userId) {
        callbacks.onIceCandidate(event.payload.candidate);
      }
    });
    unlisteners.push(unlistenIce);

    const unlistenState = await listen<{ userId: string; state: string }>("webrtc://connection-state", (event) => {
      if (!closed && event.payload.userId === userId) {
        callbacks.onConnectionStateChange(event.payload.state as RTCPeerConnectionState);
      }
    });
    unlisteners.push(unlistenState);

    const unlistenChannelOpen = await listen<{ userId: string; label: string }>("webrtc://channel-open", (event) => {
      if (closed || event.payload.userId !== userId) return;

      const label = event.payload.label;

      if (label === WEBRTC_CONFIG.channels.gameRpc && gameRpcChannel) {
        gameRpcChannel.markOpen();
        const handler = new RPCHandler<GameRouterContext>(gameRouter);
        gameRpcHandlerCleanup = handler.upgrade(gameRpcChannel as unknown as RTCDataChannel, {
          context: { userId },
        });
        channelTracker.markOpen(WEBRTC_CONFIG.channels.gameRpc);
      } else if (label === WEBRTC_CONFIG.channels.appRpc && appRpcChannel) {
        appRpcChannel.markOpen();
        appRpcLink = new RPCLink({ channel: appRpcChannel as unknown as RTCDataChannel });
        appClient = createORPCClient(appRpcLink) as AppClient;
        channelTracker.markOpen(WEBRTC_CONFIG.channels.appRpc);
      }
    });
    unlisteners.push(unlistenChannelOpen);

    const unlistenChannelClose = await listen<{ userId: string; label: string }>("webrtc://channel-close", (event) => {
      if (closed || event.payload.userId !== userId) return;

      const label = event.payload.label;

      if (label === WEBRTC_CONFIG.channels.gameRpc) {
        gameRpcHandlerCleanup?.();
        gameRpcHandlerCleanup = null;
        channelTracker.markClosed(WEBRTC_CONFIG.channels.gameRpc);
      } else if (label === WEBRTC_CONFIG.channels.appRpc) {
        appRpcLink?.close();
        appRpcLink = null;
        appClient = null;
        channelTracker.markClosed(WEBRTC_CONFIG.channels.appRpc);
      }
    });
    unlisteners.push(unlistenChannelClose);

    if (closed) {
      for (const unlisten of unlisteners) {
        unlisten();
      }
      unlisteners.length = 0;
    }
  };

  const initChannels = async () => {
    gameRpcChannel = new RustDataChannel(userId, WEBRTC_CONFIG.channels.gameRpc);
    appRpcChannel = new RustDataChannel(userId, WEBRTC_CONFIG.channels.appRpc);

    const gameCleanup = await gameRpcChannel.startListening();
    const appCleanup = await appRpcChannel.startListening();

    if (closed) {
      gameCleanup();
      appCleanup();
      return;
    }

    gameRpcChannelCleanup = gameCleanup;
    appRpcChannelCleanup = appCleanup;
  };

  const initPromise = initChannels().then(() => setupEventListeners());

  const convertIceServers = (servers: RTCIceServer[]): IceServerConfig[] =>
    servers.map((server) => ({
      urls: server.urls,
      username: server.username || undefined,
      credential: typeof server.credential === "string" ? server.credential : undefined,
    }));

  const isDataChannelOpen = (): boolean => channelTracker.allOpen;

  const createAnswer = async (offerSdp: string): Promise<string> => {
    await initPromise;

    const result = await commands.webrtcCreateAnswer(userId, offerSdp, convertIceServers(iceServers));
    if (result.status === "error") {
      throw new Error(result.error.data);
    }

    return result.data;
  };

  const addIceCandidate = async (candidate: string): Promise<void> => {
    const result = await commands.webrtcAddIceCandidate(userId, candidate);
    if (result.status === "error") {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, result.error);
    }
  };

  const close = (): void => {
    closed = true;

    appRpcLink?.close();
    appRpcLink = null;
    gameRpcHandlerCleanup?.();
    gameRpcHandlerCleanup = null;

    gameRpcChannelCleanup?.();
    gameRpcChannelCleanup = null;
    appRpcChannelCleanup?.();
    appRpcChannelCleanup = null;

    for (const unlisten of unlisteners) {
      unlisten();
    }
    unlisteners.length = 0;

    commands.webrtcCloseConnection(userId).then((result) => {
      if (result.status === "error") {
        console.error(`[WebRTC] Failed to close connection for ${userId}:`, result.error);
      }
    });

    appClient = null;
    gameRpcChannel = null;
    appRpcChannel = null;
    channelTracker.reset();
  };

  const getAppClient = (): AppClient | null => appClient;

  return {
    userId,
    createAnswer,
    addIceCandidate,
    close,
    isDataChannelOpen,
    getAppClient,
  };
}
