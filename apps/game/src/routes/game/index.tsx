import { createFileRoute } from "@tanstack/solid-router";
import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import GameLayout from "~/components/game/game-layout";
import Half from "~/components/game/half";
import PauseMenu from "~/components/game/pause-menu";
import Progress from "~/components/game/progress";
import type { SongPlayerRef } from "~/components/song-player";
import SongPlayer from "~/components/song-player";
import { useNavigation } from "~/hooks/navigation";
import { createGame } from "~/lib/game/game";
import { roundStore, useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

export const Route = createFileRoute("/game/")({
  component: GameComponent,
});

function GameComponent() {
  const [songPlayerRef, setSongPlayerRef] = createSignal<SongPlayerRef>();
  const [ready, setReady] = createSignal(false);
  const [canPlayThrough, setCanPlayThrough] = createSignal(false);
  const roundActions = useRoundActions();

  const { GameProvider, start, pause, resume, playing, started, scores } = createGame(() => ({
    songPlayerRef: songPlayerRef(),
    song: roundStore.settings()?.song,
  }));

  const paused = () => !playing() && started();

  useNavigation(() => ({
    layer: 0,
    onKeydown: (event) => {
      if (event.action === "back" && started()) {
        pause();
      }
    },
  }));

  createEffect(() => {
    if (ready() && canPlayThrough()) {
      start();
    }
  });

  onMount(() => {
    setTimeout(() => {
      setReady(true);
    }, 3000);
  });

  onCleanup(async () => {
    stop();
  });

  const handleEnded = () => {
    roundActions.endRound(scores());
  };

  const gradient = () => {
    if (roundStore.settings()?.returnTo) {
      return "gradient-party";
    }
    return "gradient-sing";
  };

  return (
    <GameLayout>
      <GameProvider>
        <div class="relative h-full w-full">
          <div
            class="relative z-1 h-full w-full"
            classList={{
              "pointer-events-none opacity-0": paused(),
            }}
          >
            <div class="absolute inset-0">
              <Show when={roundStore.settings()}>
                {(settings) => (
                  <SongPlayer
                    volume={settingsStore.getVolume("game")}
                    onCanPlayThrough={() => setCanPlayThrough(true)}
                    ref={setSongPlayerRef}
                    playing={playing()}
                    class="h-full w-full"
                    song={settings().song}
                    onEnded={handleEnded}
                  />
                )}
              </Show>
            </div>
            <div class="relative z-1 grid h-full flex-grow grid-rows-[1fr_1fr]">
              <Half index={0} />
              <Half index={1} />
            </div>
            <div class="absolute inset-0">
              <Progress />
            </div>
          </div>

          <Show when={paused()}>
            <PauseMenu class="absolute inset-0" onClose={resume} onExit={handleEnded} gradient={gradient()} />
          </Show>

          <div
            class="absolute inset-0 z-2 bg-black transition-opacity duration-1000"
            classList={{
              "pointer-events-none opacity-0": started(),
            }}
          >
            <img
              class="absolute inset-0 block h-full w-full scale-110 transform object-cover opacity-60 blur-xl"
              src={roundStore.settings()?.song.coverUrl || roundStore.settings()?.song.backgroundUrl}
              alt=""
            />
            <div class="relative flex h-full w-full flex-col items-center justify-center gap-2">
              <p class="text-3xl">{roundStore.settings()?.song.artist}</p>
              <div class="max-w-200">
                <span class={`${gradient()} bg-gradient-to-b bg-clip-text text-center font-bold text-7xl text-transparent`}>
                  {roundStore.settings()?.song.title}
                </span>
              </div>
            </div>
          </div>
        </div>
      </GameProvider>
    </GameLayout>
  );
}
