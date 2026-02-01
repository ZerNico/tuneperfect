import type { DataChannelHandlers, DataChannelSetupResult } from "./types";

export function setupDataChannelHandlers(
  channel: RTCDataChannel,
  handlers: DataChannelHandlers,
): DataChannelSetupResult {
  const openHandler = handlers.onOpen ? () => handlers.onOpen?.() : null;
  const closeHandler = handlers.onClose ? () => handlers.onClose?.() : null;
  const errorHandler = handlers.onError ? (e: Event) => handlers.onError?.(e) : null;
  const messageHandler = handlers.onMessage ? (e: MessageEvent) => handlers.onMessage?.(e.data) : null;

  if (openHandler) channel.addEventListener("open", openHandler);
  if (closeHandler) channel.addEventListener("close", closeHandler);
  if (errorHandler) channel.addEventListener("error", errorHandler);
  if (messageHandler) channel.addEventListener("message", messageHandler);

  const cleanup = () => {
    if (openHandler) channel.removeEventListener("open", openHandler);
    if (closeHandler) channel.removeEventListener("close", closeHandler);
    if (errorHandler) channel.removeEventListener("error", errorHandler);
    if (messageHandler) channel.removeEventListener("message", messageHandler);
  };

  return { cleanup };
}

// Tracks open state of multiple channels, calls callback when all are open
export function createChannelTracker(channelNames: readonly string[], onAllOpen: () => void) {
  const openChannels = new Set<string>();

  return {
    markOpen(channelName: string) {
      openChannels.add(channelName);
      if (openChannels.size === channelNames.length) {
        onAllOpen();
      }
    },

    markClosed(channelName: string) {
      openChannels.delete(channelName);
    },

    get allOpen() {
      return openChannels.size === channelNames.length;
    },

    isOpen(channelName: string) {
      return openChannels.has(channelName);
    },

    reset() {
      openChannels.clear();
    },
  };
}

export type ChannelTracker = ReturnType<typeof createChannelTracker>;

export function createOrderedDataChannel(pc: RTCPeerConnection, label: string, options?: Partial<RTCDataChannelInit>) {
  return pc.createDataChannel(label, {
    ordered: true,
    ...options,
  });
}
