import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import Confetti from "~/components/fx/confetti";
import HighscoreList from "~/components/highscore-list";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import ScoreLane, { type LaneSize } from "~/components/score/score-lane";
import TitleBar from "~/components/title-bar";
import Button from "~/components/ui/button";
import { effectsEnabled } from "~/lib/fx";
import { useRoundResults } from "~/lib/game/round-results";
import { t } from "~/lib/i18n";
import { playSound, type SoundName } from "~/lib/sound";
import type { TierId } from "~/lib/utils/score";
import { roundStore, useRoundActions } from "~/stores/round";

// Reveal timeline
const FILL_MS = 4000;
/** A tick every time the bars cover this share of the way, so ticks slow down as the bars do. */
const TICK_STEP = 0.025;
const TIER_DELAY_MS = 350;
const STATS_DELAY_MS = 900;
const DONE_DELAY_MS = 600;

/** Fast start, long slow finish: the last points build suspense. */
const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

const RANK_SOUNDS: Record<TierId, SoundName> = {
  d: "tierD",
  c: "tierC",
  b: "tierB",
  a: "tierA",
  s: "tierS",
  splus: "tierSPlus",
};

const CONFETTI_COLORS = [
  "var(--color-yellow-300)",
  "var(--color-pink-400)",
  "var(--color-sky-400)",
  "var(--color-green-400)",
  "var(--color-purple-400)",
];

export default function ScoreScreen() {
  const round = useRoundResults();
  const roundActions = useRoundActions();

  const laneSize = (): LaneSize => {
    const count = round.players().length;
    return count === 1 ? "lg" : count === 2 ? "md" : "sm";
  };

  // Reveal state
  const [fill, setFill] = createSignal(0);
  const [tiersShown, setTiersShown] = createSignal(0);
  const [statsShown, setStatsShown] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [instant, setInstant] = createSignal(!effectsEnabled());
  const [confetti, setConfetti] = createSignal<number>();
  const [flash, setFlash] = createSignal<number>();

  let frame: number | undefined;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, callback: () => void) => timers.push(setTimeout(callback, ms));
  const stop = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    timers.length = 0;
  };
  onCleanup(stop);

  /** All ranks land together; each distinct rank sound plays once. */
  const showRanks = () => {
    const tiers = new Set(round.players().map((result) => result.tier));
    setTiersShown(round.players().length);

    // Uncorrelated sounds add up in power, so 1/√n keeps the mix about as loud as one sound.
    const gain = 1 / Math.sqrt(tiers.size);
    for (const tier of tiers) playSound(RANK_SOUNDS[tier], { gain });

    if (tiers.has("s") || tiers.has("splus")) setConfetti(Date.now());
    if (tiers.has("splus")) setFlash(Date.now());
  };

  const finish = () => {
    stop();
    setFill(1);
    setTiersShown(round.players().length);
    setStatsShown(true);
    setDone(true);
  };

  const start = () => {
    stop();
    setFill(0);
    setTiersShown(0);
    setStatsShown(false);
    setDone(false);

    if (!effectsEnabled()) {
      finish();
      return;
    }

    // One clock for every bar, so all players rise together.
    const startTime = performance.now();
    let lastTick = 0;
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / FILL_MS, 1);
      const eased = easeOutCubic(progress);
      setFill(eased);

      if (eased - lastTick >= TICK_STEP) {
        lastTick = eased;
        playSound("countTick");
      }

      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }

      at(TIER_DELAY_MS, showRanks);
      at(TIER_DELAY_MS + STATS_DELAY_MS, () => setStatsShown(true));
      at(TIER_DELAY_MS + STATS_DELAY_MS + DONE_DELAY_MS, () => setDone(true));
    };
    frame = requestAnimationFrame(step);
  };

  onMount(() => {
    round.commit();
    start();
  });

  const handleContinue = () => {
    if (!done()) {
      // First press skips the reveal.
      setInstant(true);
      finish();
      return;
    }
    if (round.saving()) return;

    playSound("confirm");
    roundActions.returnRound();
  };

  const isWinner = createMemo(() => (total: number) => round.players().length > 1 && total === round.topScore());

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("score.title")} />}
      footer={
        <div class="flex items-center justify-between gap-8">
          <div class="flex items-center gap-4">
            <KeyHints hints={["confirm"]} />
          </div>
          <Button
            loading={done() && round.saving()}
            selected
            gradient={roundStore.settings()?.returnTo ? "gradient-party" : "gradient-sing"}
            class="w-[30cqw]"
            onClick={handleContinue}
          >
            {done() ? t("score.continue") : t("score.skip")}
          </Button>
        </div>
      }
    >
      <Show when={effectsEnabled() && flash()} keyed>
        {(_) => <div class="pointer-events-none absolute inset-0 z-20 animate-flash bg-white" />}
      </Show>
      <Confetti trigger={confetti()} colors={CONFETTI_COLORS} count={60} class="z-20" />

      <div class="flex h-full min-h-0 gap-10">
        <div
          class="flex min-h-0 min-w-0 grow flex-col justify-center"
          classList={{ "gap-6": laneSize() !== "sm", "gap-2.5": laneSize() === "sm" }}
        >
          <For each={round.players()}>
            {(result, index) => (
              <ScoreLane
                result={result}
                // One shared level rises for everyone and each bar stops at its own total, so bars
                // climb side by side and the winner only shows once the others have stopped.
                shownScore={Math.min(result.total, round.topScore() * fill())}
                maxScore={round.maxScore()}
                size={laneSize()}
                index={index()}
                tierRevealed={tiersShown() > index()}
                statsRevealed={statsShown()}
                newRecord={statsShown() && round.isNewRecord(result)}
                winner={done() && isWinner()(result.total)}
                instant={instant()}
              />
            )}
          </For>
        </div>

        <Show when={round.tracksHighscore()}>
          <div
            class="flex w-[21cqw] shrink-0 flex-col justify-center transition-opacity duration-500"
            classList={{ "opacity-0": !done() }}
          >
            <HighscoreList scores={round.highscores()} class="h-[40cqh] w-full" />
          </div>
        </Show>
      </div>
    </Layout>
  );
}
