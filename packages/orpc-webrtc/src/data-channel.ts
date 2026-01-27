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
 */
export function onDataChannelMessage(channel: RTCDataChannel, callback: (data: unknown) => void): void {
  channel.addEventListener("message", (event) => {
    callback(event.data);
  });
}

/**
 * Listen for the data channel close event.
 */
export function onDataChannelClose(channel: RTCDataChannel, callback: () => void): void {
  channel.addEventListener("close", () => {
    callback();
  });
}
