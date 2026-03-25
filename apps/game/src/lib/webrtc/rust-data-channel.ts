import type { UnlistenFn } from "@tauri-apps/api/event";

import { commands, events } from "~/bindings";

/**
 * Adapter that mimics the browser RTCDataChannel interface but routes
 * send/receive through Tauri IPC to a Rust-managed WebRTC peer connection.
 */
export class RustDataChannel extends EventTarget {
  private _readyState: RTCDataChannelState = "connecting";
  private _label: string;
  private _userId: string;
  private _unlistenMessage: UnlistenFn | null = null;
  private _unlistenClose: UnlistenFn | null = null;

  constructor(userId: string, label: string) {
    super();
    this._userId = userId;
    this._label = label;
  }

  get label(): string {
    return this._label;
  }

  get readyState(): RTCDataChannelState {
    return this._readyState;
  }

  async startListening(): Promise<() => void> {
    this._unlistenMessage = await events.channelMessageEvent.listen((event) => {
      if (event.payload.userId === this._userId && event.payload.label === this._label) {
        this.dispatchEvent(new MessageEvent("message", { data: event.payload.data }));
      }
    });

    this._unlistenClose = await events.channelCloseEvent.listen((event) => {
      if (event.payload.userId === this._userId && event.payload.label === this._label) {
        this._readyState = "closed";
        this.dispatchEvent(new Event("close"));
      }
    });

    return () => this.cleanup();
  }

  markOpen(): void {
    this._readyState = "open";
    this.dispatchEvent(new Event("open"));
  }

  send(data: string | ArrayBuffer): void {
    if (this._readyState !== "open") {
      throw new DOMException("InvalidStateError: channel is not open");
    }

    const strData = typeof data === "string" ? data : new TextDecoder().decode(data);

    commands.webrtcSendMessage(this._userId, this._label, strData).then((result) => {
      if (result.status === "error") {
        console.error(`[RustDataChannel] Failed to send on '${this._label}':`, result.error);
      }
    });
  }

  close(): void {
    this._readyState = "closed";
    this.dispatchEvent(new Event("close"));
  }

  cleanup(): void {
    this._unlistenMessage?.();
    this._unlistenMessage = null;
    this._unlistenClose?.();
    this._unlistenClose = null;
  }
}
