// Exercises the addon from plain Node, without Electron:
//   bun run native:build && node native/examples/smoke.cjs [songFolder]
// Lists microphones, parses a song folder through the media server, then records from
// the first microphone for a few seconds while printing levels and pitches. The terminal
// running this needs microphone access, or the levels stay at zero.
const native = require("../index.cjs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const microphones = await native.getMicrophones();
  console.log("microphones:", microphones);

  const baseUrl = await native.startLocalServer([]);
  console.log("media server:", baseUrl);

  const folder = process.argv[2];
  if (folder) {
    console.log("allowDirectory:", native.allowDirectory(folder));
    let progress = 0;
    const started = performance.now();
    const groups = await native.parseSongsFromPaths([folder], (event) => {
      if (event.type === "start") console.log("parsing", event.total, "files");
      else progress++;
    });
    const songs = groups.flatMap((group) => group.songs);
    console.log(`parsed ${songs.length} songs (${progress} progress events) in ${Math.round(performance.now() - started)} ms`);

    const audioUrl = songs.find((song) => song.audioUrl)?.audioUrl;
    if (audioUrl) {
      const response = await fetch(audioUrl, { headers: { Range: "bytes=0-1023" } });
      console.log("media fetch:", response.status, response.headers.get("content-range"));
    }
  }

  const microphone = microphones[0];
  if (!microphone) return;

  await native.startRecording(
    [{ deviceId: microphone.id, name: microphone.name, channel: 0, gain: 1, threshold: 1, delay: 0 }],
    false,
    0,
  );

  const timings = [];
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    const started = performance.now();
    const pitches = await native.getPitches(100);
    timings.push(performance.now() - started);
    const levels = await native.getAudioLevels();
    console.log(`level ${levels[0]?.toFixed(4)}  pitch ${pitches[0]?.toFixed(1)} Hz`);
  }
  await native.stopRecording();

  timings.sort((a, b) => a - b);
  console.log(
    `getPitches in-process: p50 ${timings[15].toFixed(3)} ms, max ${timings.at(-1).toFixed(3)} ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
