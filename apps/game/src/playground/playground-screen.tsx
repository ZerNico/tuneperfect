import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { native } from "~/lib/native/client";
import { voiceCount } from "~/lib/ultrastar/song";
import { isDuet } from "~/lib/utils/song";
import { tryCatch } from "~/lib/utils/try-catch";
import { type PlayerSelection, useRoundActions } from "~/stores/round";
import { type Microphone, settingsStore, updateSettings } from "~/stores/settings";
import { songsStore } from "~/stores/songs";

const SINGER_KEY = "tp.simulatedSinger";
const COLORS = ["sky", "red", "green", "yellow"];

/** Stand-ins when fewer microphones are set up than players: they record nothing. */
const fakeMicrophone = (index: number): Microphone => ({
  name: `Playground ${index + 1}`,
  channel: 0,
  color: COLORS[index] ?? "sky",
  delay: 0,
  gain: 1,
  threshold: 1,
});

export default function PlaygroundScreen() {
  const roundActions = useRoundActions();
  const [query, setQuery] = createSignal("");
  const [playerCount, setPlayerCount] = createSignal(1);
  const [singer, setSinger] = createSignal(localStorage.getItem(SINGER_KEY) ?? "");

  const [loaded] = createResource(async () => {
    const [, paths] = await tryCatch(native.app.songPaths());
    await songsStore.updateLocalSongs(paths ?? songsStore.paths());
    return true;
  });

  const songs = createMemo(() => {
    const words = query().toLowerCase().split(/\s+/).filter(Boolean);
    return songsStore
      .songs()
      .filter((song) => words.every((word) => `${song.artist} ${song.title}`.toLowerCase().includes(word)))
      .slice(0, 200);
  });

  const view = () => settingsStore.general().singingView;
  const updateView = (value: "classic" | "scrolling") => updateSettings("general", "singingView", value);
  const updateSinger = (value: string) => {
    if (value) localStorage.setItem(SINGER_KEY, value);
    else localStorage.removeItem(SINGER_KEY);
    setSinger(value);
  };

  const start = (song: ReturnType<typeof songs>[number]) => {
    const voices = voiceCount(song);
    const players: PlayerSelection[] = Array.from({ length: playerCount() }, (_, index) => ({
      player: { id: "guest", username: `Player ${index + 1}`, type: "guest" },
      voice: isDuet(song) ? index % voices : 0,
      microphone: settingsStore.microphones()[index] ?? fakeMicrophone(index),
    }));
    roundActions.startRound({ songs: [{ song, players, mode: "single", length: "full" }], returnTo: "/" });
  };

  const button = "rounded bg-white/10 px-3 py-1 hover:bg-white/20";
  const active = "bg-white/40!";

  return (
    <div class="flex h-screen flex-col gap-4 bg-slate-900 p-6 text-sm">
      <div class="flex flex-wrap items-center gap-6">
        <h1 class="text-xl font-bold">Playground</h1>
        <label class="flex items-center gap-2">
          Players
          <For each={[1, 2, 3, 4]}>
            {(count) => (
              <button
                type="button"
                class={button}
                classList={{ [active]: playerCount() === count }}
                onClick={() => setPlayerCount(count)}
              >
                {count}
              </button>
            )}
          </For>
        </label>
        <label class="flex items-center gap-2">
          View
          <For each={["classic", "scrolling"] as const}>
            {(value) => (
              <button
                type="button"
                class={button}
                classList={{ [active]: view() === value }}
                onClick={() => updateView(value)}
              >
                {value}
              </button>
            )}
          </For>
        </label>
        <label class="flex items-center gap-2">
          Simulated singer accuracy (empty: microphones)
          <input
            class="rounded w-20 bg-white/10 px-2 py-1"
            value={singer()}
            onChange={(event) => updateSinger(event.currentTarget.value.trim())}
          />
        </label>
      </div>
      <input
        class="rounded bg-white/10 px-3 py-2"
        placeholder="Search"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <Show when={loaded()} fallback={<p>Loading songs…</p>}>
        <ul class="grow overflow-y-auto">
          <For each={songs()}>
            {(song) => (
              <li>
                <button type="button" class="w-full px-2 py-1 text-left hover:bg-white/10" onClick={() => start(song)}>
                  {song.artist} – {song.title}
                  <Show when={isDuet(song)}>
                    <span class="ml-2 text-white/50">duet</span>
                  </Show>
                  <span class="ml-2 text-white/50">{song.bpm?.toFixed(0)} BPM</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
