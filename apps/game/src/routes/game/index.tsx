import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
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
  const navigate = useNavigate();
  const [songPlayerRef, setSongPlayerRef] = createSignal<SongPlayerRef>();
  const [ready, setReady] = createSignal(false);
  const [canPlayThrough, setCanPlayThrough] = createSignal(false);
  const roundActions = useRoundActions();

  const roundSong = () => roundStore.settings()?.songs[0];

  const { GameProvider, start, stop, pause, resume, playing, started, scores, skip, setPreferInstrumental, preferInstrumental, resetScores } =
    createGame(() => ({
      songPlayerRef: songPlayerRef(),
      song: roundSong()?.song,
    }));

  const paused = () => !playing() && started();

  useNavigation(() => ({
    layer: 0,
    onKeydown: (event) => {
      if (!started()) {
        return;
      }

      if (event.action === "back") {
        pause();
      } else if (event.action === "skip") {
        skip();
      } else if (event.action === "instrumental") {
        setPreferInstrumental((value) => !value);
      }
    },
  }));

  createEffect(() => {
    if (ready() && canPlayThrough()) {
      start();
    }
  });

  onMount(() => {
    const startTimeout = roundSong()?.mode === "medley" ? 1000 : 3000;
    setTimeout(() => {
      setReady(true);
    }, startTimeout);
  });

  onCleanup(async () => {
    stop();
  });

  const handleEnded = () => {
    queueMicrotask(() => {
      roundActions.endRound(scores());
    });
  };

  const gradient = () => {
    if (roundStore.settings()?.returnTo) {
      return "gradient-party";
    }
    return "gradient-sing";
  };

  const handleRestart = () => {
    resetScores();
    navigate({ to: "/game/restart", replace: true });
  };

  const handleError = () => {
    roundActions.returnRound();
  };

  return (
    <GameLayout>
      <GameProvider>
        <Show when={roundSong()}>
          {(roundSong) => (
            <div class="relative h-full w-full">
              <div
                class="relative z-1 h-full w-full"
                classList={{
                  "pointer-events-none opacity-0": paused(),
                }}
              >
                <div class="absolute inset-0">
                  <SongPlayer
                    volume={settingsStore.getVolume("game")}
                    onCanPlayThrough={() => setCanPlayThrough(true)}
                    ref={setSongPlayerRef}
                    playing={playing()}
                    class="h-full w-full"
                    song={roundSong()?.song}
                    onEnded={handleEnded}
                    onError={handleError}
                    preferInstrumental={preferInstrumental()}
                    mode={roundSong()?.mode}
                  />
                </div>
                <div class="relative z-1 grid h-full grow grid-rows-[1fr_1fr]">
                  <Show when={roundSong()?.players[0]}>
                    <Half index={0} />
                  </Show>
                  <Show when={roundSong()?.players[1]}>
                    <Half index={1} />
                  </Show>
                </div>
                <div class="absolute inset-0">
                  <Progress />
                </div>
              </div>

              <Show when={paused()}>
                <PauseMenu class="absolute inset-0" onClose={resume} onExit={handleEnded} onRestart={handleRestart} gradient={gradient()} />
              </Show>

              <div
                class="absolute inset-0 z-2 bg-black transition-opacity duration-1000"
                classList={{
                  "pointer-events-none opacity-0": started(),
                }}
              >
                <img
                  class="absolute inset-0 block h-full w-full scale-110 transform object-cover opacity-60 blur-xl"
                  src={roundSong()?.song.coverUrl ?? roundSong()?.song.backgroundUrl ?? ""}
                  alt=""
                />
                <div class="relative flex h-full w-full flex-col items-center justify-center gap-2">
                  <p class="text-3xl">{roundSong()?.song.artist}</p>
                  <div class="max-w-200">
                    <span class={`${gradient()} bg-linear-to-b bg-clip-text text-center font-bold text-7xl text-transparent`}>
                      {roundSong()?.song.title}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Show>
      </GameProvider>
    </GameLayout>
  );
}
