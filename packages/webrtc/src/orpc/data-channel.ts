export type DataChannelMessageData = string | ArrayBuffer;

export function postDataChannelMessage(channel: RTCDataChannel, data: DataChannelMessageData) {
  if (typeof data === "string") {
    channel.send(data);
  } else {
    channel.send(new Uint8Array(data));
  }
}

export function onDataChannelMessage(channel: RTCDataChannel, callback: (data: unknown) => void) {
  const handler = (event: MessageEvent) => callback(event.data);
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

export function onDataChannelClose(channel: RTCDataChannel, callback: () => void) {
  const handler = () => callback();
  channel.addEventListener("close", handler);
  return () => channel.removeEventListener("close", handler);
}
