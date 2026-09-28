export type DataChannelMessageData = string | ArrayBuffer;

const CHUNK_PREFIX = "\x01CHUNK:";

/**
 * Strings longer than this many UTF-16 code units are split. A code unit is at most 3 bytes
 * of UTF-8 (a surrogate pair is 4 bytes for 2 units), so every chunk stays under 48 KB,
 * safely below the 64 KB SCTP message limit some peers advertise.
 */
const MAX_CHUNK_LENGTH = 16_000;

/** Splits `data` into pieces of at most `maxLength` code units without breaking surrogate pairs. */
export function splitIntoChunks(data: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < data.length) {
    let end = Math.min(start + maxLength, data.length);
    const last = data.charCodeAt(end - 1);
    // Ending on a high surrogate would split a pair; leave it for the next chunk.
    if (end < data.length && end - start > 1 && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(data.slice(start, end));
    start = end;
  }
  return chunks;
}

export function postDataChannelMessage(channel: RTCDataChannel, data: DataChannelMessageData) {
  if (typeof data !== "string") {
    channel.send(new Uint8Array(data));
    return;
  }

  if (data.length <= MAX_CHUNK_LENGTH) {
    channel.send(data);
    return;
  }

  // Large messages go out as numbered chunks that `onDataChannelMessage` reassembles.
  const id = crypto.randomUUID();
  const chunks = splitIntoChunks(data);
  for (const [index, chunk] of chunks.entries()) {
    channel.send(`${CHUNK_PREFIX}${id}:${index}:${chunks.length}\n${chunk}`);
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
