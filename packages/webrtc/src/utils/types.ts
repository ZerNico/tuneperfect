export interface DataChannelHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onMessage?: (data: unknown) => void;
}

export interface DataChannelSetupResult {
  cleanup: () => void;
}

export interface HeartbeatOptions {
  interval?: number;
  timeout?: number;
  onFailure?: () => void;
}
