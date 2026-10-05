import { describe, expect, it } from "bun:test";

import { onDataChannelMessage, postDataChannelMessage, splitIntoChunks } from "./data-channel";

/** Just enough of an RTCDataChannel: what's sent is recorded, and `deliver` plays messages to the listeners. */
function fakeChannel() {
  const target = new EventTarget();
  const sent: unknown[] = [];
  const channel = Object.assign(target, {
    send: (data: unknown) => sent.push(data),
  }) as unknown as RTCDataChannel;
  const deliver = (data: unknown) => target.dispatchEvent(new MessageEvent("message", { data }));
  return { channel, sent, deliver };
}

function receive(channel: RTCDataChannel) {
  const received: unknown[] = [];
  onDataChannelMessage(channel, (data) => received.push(data));
  return received;
}

describe("data channel messages", () => {
  it("sends a long message in chunks and puts it back together", () => {
    const { channel, sent, deliver } = fakeChannel();
    const message = "😀a".repeat(20_000);
    postDataChannelMessage(channel, message);
    expect(sent.length).toBeGreaterThan(1);

    const received = receive(channel);
    for (const chunk of sent.toReversed()) deliver(chunk);
    expect(received).toEqual([message]);
  });

  it("never splits a surrogate pair", () => {
    for (const chunk of splitIntoChunks("a😀".repeat(10), 4)) {
      const last = chunk.charCodeAt(chunk.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });

  it("ignores chunk headers with impossible counts or indices", () => {
    const { channel, deliver } = fakeChannel();
    const received = receive(channel);
    for (const header of ["x:0:NaN", "x:0:0", "x:0:999999999", "x:5:2", "x:-1:2", "x:a:2"]) {
      deliver(`\x01CHUNK:${header}\npayload`);
    }
    expect(received).toEqual([]);
  });

  it("doesn't take a repeated chunk as another part", () => {
    const { channel, deliver } = fakeChannel();
    const received = receive(channel);
    deliver("\x01CHUNK:x:0:2\nab");
    deliver("\x01CHUNK:x:0:2\nab");
    expect(received).toEqual([]);
    deliver("\x01CHUNK:x:1:2\ncd");
    expect(received).toEqual(["abcd"]);
  });

  it("limits how many messages are reassembled at once", () => {
    const { channel, deliver } = fakeChannel();
    const received = receive(channel);
    for (let i = 0; i < 1_000; i++) deliver(`\x01CHUNK:m${i}:0:2\n`);
    // The early ones still complete; the flood beyond the limit was never buffered.
    deliver("\x01CHUNK:m0:1:2\nok");
    deliver("\x01CHUNK:m999:1:2\nlost");
    expect(received).toEqual(["ok"]);
  });

  it("passes plain messages through", () => {
    const { channel, deliver } = fakeChannel();
    const received = receive(channel);
    deliver("hello");
    expect(received).toEqual(["hello"]);
  });
});
