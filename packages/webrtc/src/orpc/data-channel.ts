export type DataChannelMessageData = string | ArrayBuffer;

const CHUNK_PREFIX = "\x01CHUNK:";

export function postDataChannelMessage(channel: RTCDataChannel, data: DataChannelMessageData) {
  if (typeof data === "string") {
    channel.send(data);
  } else {
    channel.send(new Uint8Array(data));
  }
}

export function onDataChannelMessage(channel: RTCDataChannel, callback: (data: unknown) => void) {
  const chunkBuffers = new Map<string, { total: number; parts: Map<number, string> }>();

  const handler = (event: MessageEvent) => {
    const raw = event.data;

    if (typeof raw === "string" && raw.startsWith(CHUNK_PREFIX)) {
      const newlineIdx = raw.indexOf("\n");
      if (newlineIdx === -1) return;

      const header = raw.slice(CHUNK_PREFIX.length, newlineIdx);
      const [id, indexStr, totalStr] = header.split(":");
      if (!id || !indexStr || !totalStr) return;

      const index = Number.parseInt(indexStr, 10);
      const total = Number.parseInt(totalStr, 10);
      const payload = raw.slice(newlineIdx + 1);

      let buf = chunkBuffers.get(id);
      if (!buf) {
        buf = { total, parts: new Map() };
        chunkBuffers.set(id, buf);
      }

      buf.parts.set(index, payload);

      if (buf.parts.size === buf.total) {
        chunkBuffers.delete(id);
        const sorted = Array.from(buf.parts.entries())
          .toSorted((a, b) => a[0] - b[0])
          .map(([, v]) => v);
        callback(sorted.join(""));
      }
    } else {
      callback(raw);
    }
  };

  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    chunkBuffers.clear();
  };
}

export function onDataChannelClose(channel: RTCDataChannel, callback: () => void) {
  const handler = () => callback();
  channel.addEventListener("close", handler);
  return () => channel.removeEventListener("close", handler);
}
