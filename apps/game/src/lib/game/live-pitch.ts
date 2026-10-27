import { DeliveryClock } from "~/lib/audio/delivery-clock";
import { subscribePitchStream } from "~/lib/audio/pitch-stream";
import { PitchTimeline } from "~/lib/audio/pitch-timeline";

import { SongClock } from "./scrolling/song-clock";
import type { SimulatedSinger } from "./simulated-singer";

export interface LivePitch {
  /** The pitch history of a mic (by player slot), in song time. */
  timeline: (mic: number) => PitchTimeline | undefined;
  /** The game loop's frame: song time `songMs` at `perfMs`. */
  frame: (perfMs: number, songMs: number, playing: boolean) => void;
  dispose: () => void;
}

/** One simulated frame every 10 ms, like the native analysis. */
const SIMULATED_FRAME_MS = 10;

/**
 * Live pitch from a simulated singer instead of microphones (development): frames are made on
 * the song's own clock, every 10 ms, delayed by each mic's `delays` like a real voice would be.
 */
export function createSimulatedLivePitch(singer: SimulatedSinger, delays: number[]): LivePitch {
  const timelines = delays.map(() => new PitchTimeline());
  let last: number | undefined;

  return {
    timeline: (mic) => timelines[mic],
    frame: (_perfMs, songMs, playing) => {
      if (!playing) return;
      if (last === undefined || songMs < last || songMs - last > 1000) {
        for (const timeline of timelines) timeline.clear();
        last = songMs;
        return;
      }
      for (let time = last + SIMULATED_FRAME_MS; time <= songMs; time += SIMULATED_FRAME_MS) {
        for (const [mic, timeline] of timelines.entries()) {
          timeline.push(time, singer.hzAt(mic, time - (delays[mic] ?? 0)), 0.5);
        }
        last = time;
      }
    },
    dispose: () => {},
  };
}

/**
 * The live pitch stream, placed in song time: each frame lands where it was sung (its capture
 * time, through the delivery clock and the song clock). A seek starts the timelines over, since
 * frames from before it would land in the wrong place.
 */
export function createLivePitch(): LivePitch {
  const songClock = new SongClock();
  const delivery = new DeliveryClock();
  const timelines = new Map<number, PitchTimeline>();
  let epoch = songClock.epoch;

  const dispose = subscribePitchStream((batch, receivedAt) => {
    delivery.observe(batch.sentAt, receivedAt);
    if (songClock.epoch !== epoch) {
      epoch = songClock.epoch;
      for (const timeline of timelines.values()) timeline.clear();
    }

    for (const frame of batch.frames) {
      const local = delivery.toLocal(frame.time);
      const song = local === undefined ? undefined : songClock.songAt(local);
      if (song === undefined) continue;

      let timeline = timelines.get(frame.mic);
      if (!timeline) {
        timeline = new PitchTimeline();
        timelines.set(frame.mic, timeline);
      }
      timeline.push(song, frame.hz, frame.level);
    }
  });

  return {
    timeline: (mic) => timelines.get(mic),
    frame: (perfMs, songMs, playing) => songClock.frame(perfMs, songMs, playing),
    dispose,
  };
}
