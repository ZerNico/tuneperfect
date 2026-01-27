/**
 * Utility functions for RTCDataChannel message handling.
 */

export type DataChannelMessageData = string | ArrayBuffer;

/**
 * Send a message over the data channel.
 */
export function postDataChannelMessage(channel: RTCDataChannel, data: DataChannelMessageData): void {
  if (typeof data === "string") {
    channel.send(data);
  } else {
    channel.send(new Uint8Array(data));
  }
}

/**
 * Listen for messages on the data channel.
 * @returns A cleanup function to remove the event listener.
 */
export function onDataChannelMessage(channel: RTCDataChannel, callback: (data: unknown) => void): () => void {
  const handler = (event: MessageEvent) => callback(event.data);
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

/**
 * Listen for the data channel close event.
 * @returns A cleanup function to remove the event listener.
 */
export function onDataChannelClose(channel: RTCDataChannel, callback: () => void): () => void {
  const handler = () => callback();
  channel.addEventListener("close", handler);
  return () => channel.removeEventListener("close", handler);
}
