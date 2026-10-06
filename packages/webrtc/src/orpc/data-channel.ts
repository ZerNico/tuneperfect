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

/**
 * Limits on what the other side can make us buffer while reassembling chunks: a 20k-song list is
 * about 200 chunks, so these leave plenty of room while a misbehaving peer can't grow memory
 * without bound. An incomplete message is dropped after `CHUNK_TIMEOUT_MS`.
 */
const MAX_CHUNKS_PER_MESSAGE = 4_096;
const MAX_PENDING_LENGTH = 64 * 1024 * 1024;
/** Messages being reassembled at once; replies arrive one after another, so a few is plenty. */
const MAX_PENDING_MESSAGES = 32;
const MAX_ID_LENGTH = 64;
const CHUNK_TIMEOUT_MS = 30_000;

export function onDataChannelMessage(channel: RTCDataChannel, callback: (data: unknown) => void) {
  const chunkBuffers = new Map<
    string,
    { total: number; parts: Map<number, string>; length: number; timer: ReturnType<typeof setTimeout> }
  >();
  let pendingLength = 0;

  const drop = (id: string) => {
    const buf = chunkBuffers.get(id);
    if (!buf) return;
    clearTimeout(buf.timer);
    pendingLength -= buf.length;
    chunkBuffers.delete(id);
  };

  const handler = (event: MessageEvent) => {
    const raw = event.data;

    if (typeof raw === "string" && raw.startsWith(CHUNK_PREFIX)) {
      const newlineIdx = raw.indexOf("\n");
      if (newlineIdx === -1) return;

      const header = raw.slice(CHUNK_PREFIX.length, newlineIdx);
      const [id, indexStr, totalStr] = header.split(":");
      if (!id || id.length > MAX_ID_LENGTH || !indexStr || !totalStr) return;

      const index = Number(indexStr);
      const total = Number(totalStr);
      if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS_PER_MESSAGE) return;
      if (!Number.isInteger(index) || index < 0 || index >= total) return;
      const payload = raw.slice(newlineIdx + 1);

      let buf = chunkBuffers.get(id);
      if (!buf) {
        if (chunkBuffers.size >= MAX_PENDING_MESSAGES) return;
        buf = { total, parts: new Map(), length: 0, timer: setTimeout(() => drop(id), CHUNK_TIMEOUT_MS) };
        chunkBuffers.set(id, buf);
      }
      if (buf.total !== total || buf.parts.has(index)) return;
      if (pendingLength + payload.length > MAX_PENDING_LENGTH) {
        drop(id);
        return;
      }

      buf.parts.set(index, payload);
      buf.length += payload.length;
      pendingLength += payload.length;

      if (buf.parts.size === buf.total) {
        const parts = buf.parts;
        drop(id);
        let message = "";
        for (let i = 0; i < total; i++) message += parts.get(i);
        callback(message);
      }
    } else {
      callback(raw);
    }
  };

  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    for (const id of chunkBuffers.keys()) drop(id);
  };
}

export function onDataChannelClose(channel: RTCDataChannel, callback: () => void) {
  const handler = () => callback();
  channel.addEventListener("close", handler);
  return () => channel.removeEventListener("close", handler);
}
