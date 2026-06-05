import type { UnlistenFn } from "@tauri-apps/api/event";

import { commands, events } from "~/bindings";

/**
 * Adapter that mimics the browser RTCDataChannel interface but routes
 * send/receive through Tauri IPC to a Rust-managed WebRTC peer connection.
 */
export class RustDataChannel extends EventTarget {
  #readyState: RTCDataChannelState = "connecting";
  #label: string;
  #userId: string;
  #unlistenMessage: UnlistenFn | null = null;
  #unlistenClose: UnlistenFn | null = null;

  constructor(userId: string, label: string) {
    super();
    this.#userId = userId;
    this.#label = label;
  }

  get label(): string {
    return this.#label;
  }

  get readyState(): RTCDataChannelState {
    return this.#readyState;
  }

  async startListening(): Promise<() => void> {
    this.#unlistenMessage = await events.channelMessageEvent.listen((event) => {
      if (event.payload.userId === this.#userId && event.payload.label === this.#label) {
        this.dispatchEvent(new MessageEvent("message", { data: event.payload.data }));
      }
    });

    this.#unlistenClose = await events.channelCloseEvent.listen((event) => {
      if (event.payload.userId === this.#userId && event.payload.label === this.#label) {
        this.#readyState = "closed";
        this.dispatchEvent(new Event("close"));
      }
    });

    return () => this.cleanup();
  }

  markOpen(): void {
    this.#readyState = "open";
    this.dispatchEvent(new Event("open"));
  }

  send(data: string | ArrayBuffer): void {
    if (this.#readyState !== "open") {
      throw new DOMException("InvalidStateError: channel is not open");
    }

    const strData = typeof data === "string" ? data : new TextDecoder().decode(data);

    commands.webrtcSendMessage(this.#userId, this.#label, strData).then((result) => {
      if (result.status === "error") {
        console.error(`[RustDataChannel] Failed to send on '${this.#label}':`, result.error);
      }
    });
  }

  close(): void {
    this.#readyState = "closed";
    this.dispatchEvent(new Event("close"));
  }

  cleanup(): void {
    this.#unlistenMessage?.();
    this.#unlistenMessage = null;
    this.#unlistenClose?.();
    this.#unlistenClose = null;
  }
}
