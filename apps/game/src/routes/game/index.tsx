import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import GameLayout from "~/components/game/game-layout";
import Lyrics from "~/components/game/lyrics";
import OnlineSongPlayer from "~/components/online-song-player";
import PauseMenu from "~/components/game/pause-menu";
import PlayerLane from "~/components/game/player-lane";
import Progress from "~/components/game/progress";
import type { SongPlayerRef } from "~/components/song-player";
import SongPlayer from "~/components/song-player";
import { useNavigation } from "~/hooks/navigation";
import { createGame } from "~/lib/game/game";
import { isLocalSong, isUsdbSong } from "~/lib/ultrastar/song";
import { notify } from "~/lib/toast";
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
  const isOnline = createMemo(() => {
    const song = roundSong()?.song;
    return song ? isUsdbSong(song) : false;
  });

  const localSong = createMemo(() => {
    const song = roundSong()?.song;
    return song && isLocalSong(song) ? song : null;
  });

  const usdbAudioYoutubeId = createMemo(() => {
    const song = roundSong()?.song;
    if (!song || !isUsdbSong(song)) return null;
    return song.audioYoutubeId ?? song.videoYoutubeId ?? null;
  });

  const usdbVideoYoutubeId = createMemo(() => {
    const song = roundSong()?.song;
    if (!song || !isUsdbSong(song)) return null;
    return song.videoYoutubeId ?? null;
  });

  const {
    GameProvider,
    start,
    stop,
    pause,
    resume,
    playing,
    started,
    scores,
    skip,
    setPreferInstrumental,
    preferInstrumental,
    resetScores,
  } = createGame(() => ({
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
    notify({ message: "Failed to play song", intent: "error" });
    roundActions.returnRound();
  };

  const players = createMemo(() => roundSong()?.players || []);
  const playerCount = createMemo(() => players().length);

  const voiceCount = createMemo(() => roundSong()?.song.voices.length || 1);

  const topVoice = createMemo(() => players()[0]?.voice ?? 0);
  const bottomVoice = createMemo(() => {
    if (voiceCount() > 1) {
      return topVoice() === 0 ? 1 : 0;
    }
    return topVoice();
  });

  const useQuadLayout = createMemo(() => playerCount() >= 3);
  const topPlayerCount = createMemo(() => (useQuadLayout() ? 2 : 1));
  const bottomPlayerCount = createMemo(() => (useQuadLayout() ? 2 : 1));

  const topPlayers = createMemo(() => players().slice(0, topPlayerCount()));
  const bottomPlayers = createMemo(() => {
    const count = playerCount();
    if (count === 3) {
      return players().slice(topPlayerCount(), topPlayerCount() + 1);
    }
    return players().slice(topPlayerCount(), topPlayerCount() + bottomPlayerCount());
  });

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
                  <Show
                    when={isOnline()}
                    fallback={
                      <SongPlayer
                        volume={settingsStore.getVolume("game")}
                        onCanPlayThrough={() => setCanPlayThrough(true)}
                        ref={setSongPlayerRef}
                        playing={playing()}
                        class="h-full w-full"
                        song={localSong()}
                        onEnded={handleEnded}
                        onError={handleError}
                        preferInstrumental={preferInstrumental()}
                        mode={roundSong()?.mode}
                      />
                    }
                  >
                    <OnlineSongPlayer
                      volume={settingsStore.getVolume("game")}
                      onCanPlayThrough={() => setCanPlayThrough(true)}
                      ref={setSongPlayerRef}
                      playing={playing()}
                      class="h-full w-full"
                      audioYoutubeId={usdbAudioYoutubeId()}
                      videoYoutubeId={usdbVideoYoutubeId()}
                      onEnded={handleEnded}
                      onError={handleError}
                    />
                  </Show>
                </div>

                <div class="relative z-1 flex h-full grow flex-col">
                  <Lyrics voiceIndex={topVoice()} position="top" />

                  <div class="flex grow flex-col" style={{ flex: topPlayerCount() }}>
                    <For each={topPlayers()}>
                      {(_, index) => (
                        <>
                          <PlayerLane index={index()} position="top" />
                          <Show when={index() < topPlayerCount() - 1}>
                            <div class="h-px bg-white/20" />
                          </Show>
                        </>
                      )}
                    </For>
                  </div>

                  <div class="relative z-10 h-10">
                    <Progress />
                  </div>

                  <div class="flex grow flex-col" style={{ flex: useQuadLayout() ? 2 : 1 }}>
                    <For each={bottomPlayers()}>
                      {(_, index) => {
                        const actualIndex = () => topPlayerCount() + index();
                        return (
                          <>
                            <Show when={index() > 0}>
                              <div class="h-px bg-white/20" />
                            </Show>
                            <PlayerLane index={actualIndex()} position="bottom" />
                          </>
                        );
                      }}
                    </For>
                    <Show when={playerCount() === 3}>
                      <div class="h-px bg-white/20" />
                      <div class="flex-1" />
                    </Show>
                  </div>

                  <Lyrics voiceIndex={bottomVoice()} position="bottom" />
                </div>
              </div>

              <Show when={paused()}>
                <PauseMenu
                  class="absolute inset-0"
                  onClose={resume}
                  onExit={handleEnded}
                  onRestart={handleRestart}
                  gradient={gradient()}
                />
              </Show>

              <div
                class="absolute inset-0 z-2 bg-black transition-opacity duration-1000"
                classList={{
                  "pointer-events-none opacity-0": started(),
                }}
              >
                <img
                  class="absolute inset-0 block h-full w-full scale-110 transform object-cover opacity-60 blur-xl"
                  src={(() => {
                    const song = roundSong()?.song;
                    if (!song) return "";
                    if (isUsdbSong(song)) return song.coverUrl ?? "";
                    if (isLocalSong(song)) return song.coverUrl ?? song.backgroundUrl ?? "";
                    return "";
                  })()}
                  alt=""
                />
                <div class="relative flex h-full w-full flex-col items-center justify-center gap-2">
                  <p class="text-3xl">{roundSong()?.song.artist}</p>
                  <div class="max-w-200">
                    <span
                      class={`${gradient()} bg-linear-to-b bg-clip-text text-center text-7xl font-bold text-transparent`}
                    >
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
