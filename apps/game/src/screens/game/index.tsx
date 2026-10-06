import { useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from "solid-js";

import GameLayout from "~/components/game/game-layout";
import Lyrics from "~/components/game/lyrics";
import PauseMenu from "~/components/game/pause-menu";
import PlayerLane from "~/components/game/player-lane";
import Progress from "~/components/game/progress";
import SongIntro from "~/components/game/song-intro";
import OnlineSongPlayer from "~/components/online-song-player";
import type { SongPlayerRef } from "~/components/song-player";
import SongPlayer from "~/components/song-player";
import { useNavigation } from "~/hooks/navigation";
import { createGame } from "~/lib/game/game";
import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import { isLocalSong, isUsdbSong } from "~/lib/ultrastar/song";
import { roundStore, useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

export default function GameScreen() {
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
    finish,
    pause,
    resume,
    playing,
    started,
    scores,
    stats,
    skip,
    setPreferInstrumental,
    preferInstrumental,
  } = createGame(() => ({
    songPlayerRef: songPlayerRef(),
    song: roundSong()?.song,
  }));

  const paused = () => !playing() && started();

  useNavigation(() => ({
    layer: 0,
    actions: started()
      ? {
          back: pause,
          skip,
          instrumental: () => setPreferInstrumental((value) => !value),
        }
      : {},
  }));

  createEffect(() => {
    if (ready() && canPlayThrough() && !untrack(started)) {
      untrack(start).catch((error: unknown) => {
        console.error("Failed to start the game:", error);
        notify({ message: t("game.microphonesFailed"), intent: "error" });
        // Not the song's fault: no result, so party modes don't drop it as unplayable.
        roundActions.abortRound();
      });
    }
  });

  onMount(() => {
    // Long enough for the intro card to play out after the route wipe.
    const startTimeout = roundSong()?.length === "full" ? 3000 : 1600;
    const timer = setTimeout(() => {
      setReady(true);
    }, startTimeout);
    onCleanup(() => clearTimeout(timer));
  });

  // Solid doesn't wait for cleanups; `stop` handles its own errors and an in-flight start.
  onCleanup(() => void stop());

  // The round ends once, however it ends: the song finishing waits a moment for its last notes,
  // and exiting or skipping during that moment must not record it a second time.
  let roundOver = false;
  const endOnce = (end: () => void) => {
    if (roundOver) return;
    roundOver = true;
    end();
  };

  const handleEnded = () => {
    // The last notes are scored once the mics' delay has passed; then the results are final.
    void finish().then(() => endOnce(() => roundActions.endRound(scores(), stats())));
  };

  const handleNext = () => {
    queueMicrotask(() => endOnce(() => roundActions.endRound(scores(), stats())));
  };

  const handleExit = () => {
    queueMicrotask(() =>
      endOnce(() => {
        if (roundSong()?.mode === "medley") {
          roundActions.endMedley(scores(), stats());
        } else {
          roundActions.endRound(scores(), stats());
        }
      }),
    );
  };

  const gradient = () => {
    if (roundStore.settings()?.returnTo) {
      return "gradient-party";
    }
    return "gradient-sing";
  };

  const handleRestart = () => {
    navigate({ to: "/game/restart", replace: true });
  };

  const handleError = () => {
    notify({ message: t("game.songFailed"), intent: "error" });
    roundActions.failRound();
  };

  const players = createMemo(() => roundSong()?.players || []);
  const playerCount = createMemo(() => players().length);

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

  // Each lyrics bar follows the first player of its half; with nobody below, it mirrors the top.
  const topLyricsPlayer = () => topPlayers()[0];
  const bottomLyricsPlayer = () => bottomPlayers()[0] ?? topLyricsPlayer();

  return (
    <GameLayout>
      <GameProvider>
        <Show when={roundSong()}>
          {(roundSong) => (
            <div class="relative h-full w-full">
              <div
                class="relative z-1 h-full w-full"
                classList={{
                  "pointer-events-none opacity-0 fx-paused": paused(),
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
                        mode="play"
                        useFades={roundSong()?.length !== "full"}
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
                  <Lyrics
                    voiceIndex={topLyricsPlayer()?.voice ?? 0}
                    color={topLyricsPlayer()?.microphone.color}
                    position="top"
                  />

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

                  <div class="relative z-10" classList={{ "h-10": !useQuadLayout(), "h-7": useQuadLayout() }}>
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

                  <Lyrics
                    voiceIndex={bottomLyricsPlayer()?.voice ?? 0}
                    color={bottomLyricsPlayer()?.microphone.color}
                    position="bottom"
                  />
                </div>
              </div>

              <Show when={paused()}>
                <PauseMenu
                  class="absolute inset-0"
                  onClose={resume}
                  onExit={handleExit}
                  onNext={handleNext}
                  showNext={roundSong()?.mode === "medley" && (roundStore.settings()?.songs.length ?? 0) > 1}
                  onRestart={handleRestart}
                  gradient={gradient()}
                />
              </Show>

              <SongIntro
                song={roundSong().song}
                started={started()}
                gradient={gradient()}
                accentColor={gradient() === "gradient-party" ? "purple" : "teal"}
              />
            </div>
          )}
        </Show>
      </GameProvider>
    </GameLayout>
  );
}
