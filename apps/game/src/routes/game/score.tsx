import { useMutation, useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js";
import HighscoreList from "~/components/highscore-list";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { highscoreQueryOptions } from "~/lib/queries";
import { playSound } from "~/lib/sound";
import type { User } from "~/lib/types";
import { getColorVar } from "~/lib/utils/color";
import { getMaxScore, getRelativeScore, MAX_POSSIBLE_SCORE } from "~/lib/utils/score";
import { isGuestUser, isLocalUser } from "~/lib/utils/user";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";
import { roundStore, type Score, useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

export const Route = createFileRoute("/game/score")({
  component: ScoreComponent,
});

type ScoreCategory = "normal" | "golden" | "bonus";

const ANIMATION_DURATION = 2000;
const ANIMATION_DELAY = 2000;
const ANIMATION_STEPS = 38;

interface PlayerScoreData {
  player: User;
  score: Score;
  totalScore: number;
  micColor: string;
  position: number;
}

function ScoreComponent() {
  const highscoresQuery = useQuery(() => highscoreQueryOptions(roundStore.settings()?.song?.hash ?? ""));
  const [showHighscores, setShowHighscores] = createSignal(false);
  const roundActions = useRoundActions();

  const scoreData = createMemo<PlayerScoreData[]>(() => {
    const players = roundStore.settings()?.players || [];
    const result: PlayerScoreData[] = [];

    for (const [index, player] of players.entries()) {
      const voiceIndex = roundStore.settings()?.voices[index];
      if (voiceIndex === undefined) continue;

      const voice = roundStore.settings()?.song?.voices[voiceIndex];

      if (!voice || !player) continue;

      const maxScore = getMaxScore(voice);
      const absoluteScore = roundStore.scores()[index] ?? { normal: 0, golden: 0, bonus: 0 };

      const relativeScore = getRelativeScore(absoluteScore, maxScore);

      const micColor = settingsStore.microphones()[index]?.color;
      if (!micColor) continue;

      result.push({
        player,
        score: relativeScore,
        totalScore: Math.floor(relativeScore.normal + relativeScore.golden + relativeScore.bonus),
        micColor,
        position: index + 1,
      });
    }

    return result;
  });

  const updateHighscoresMutation = useMutation(() => ({
    mutationFn: async () => {
      const scores = scoreData();
      const songHash = roundStore.settings()?.song?.hash;

      if (!songHash) return;

      for (const score of scores) {
        if (isGuestUser(score.player)) continue;

        if (score.totalScore <= 0) continue;

        if (isLocalUser(score.player)) {
          localStore.addScore(score.player.id, songHash, score.totalScore);
          continue;
        }

        // Handle API users (only if we have a lobby connection)
        if (!lobbyStore.lobby()) continue;

        await client.highscore.setHighscore.call({
          hash: songHash,
          userId: score.player.id.toString(),
          score: score.totalScore,
        });
      }
    },
  }));

  const handleContinue = () => {
    if (updateHighscoresMutation.isPending) return;

    playSound("confirm");
    roundActions.returnRound();
  };

  const animatedStages = createMemo(() => {
    const stages = new Set<ScoreCategory>();
    const scores = scoreData();

    if (!scores.length) return [];

    for (const data of scores) {
      if (data.score.normal > 0) stages.add("normal");
      if (data.score.golden > 0) stages.add("golden");
      if (data.score.bonus > 0) stages.add("bonus");
    }

    return Array.from(stages);
  });

  onMount(() => {
    updateHighscoresMutation.mutate();

    const totalAnimationTime = animatedStages().length * ANIMATION_DELAY;

    setTimeout(() => {
      setShowHighscores(true);
    }, totalAnimationTime);
  });

  const highscores = () => {
    const songHash = roundStore.settings()?.song?.hash;
    if (!songHash) return [];

    const highscores: { user: User; score: number }[] = [...(highscoresQuery.data || [])];

    // Add local scores
    const localScores = localStore.getScoresForSong(songHash);
    for (const localScore of localScores) {
      highscores.push(localScore);
    }

    // Add current session scores
    const scores = scoreData();

    for (const score of scores) {
      if (isGuestUser(score.player)) continue;
      if (score.totalScore <= 0) continue;

      const existingHighscoreIndex = highscores.findIndex((highscore) => highscore.user.id === score.player.id);
      const existingHighscore = highscores[existingHighscoreIndex];

      if (!existingHighscore) {
        highscores.push({
          user: score.player,
          score: score.totalScore,
        });
        continue;
      }

      if (score.totalScore > existingHighscore.score) {
        highscores[existingHighscoreIndex] = {
          user: score.player,
          score: score.totalScore,
        };
      }
    }

    return highscores.toSorted((a, b) => b.score - a.score);
  };

  return (
    <Layout intent="secondary" header={<TitleBar title={t("score.title")} />} footer={<KeyHints hints={["confirm"]} />}>
      <div class="flex h-full flex-col gap-6">
        <div class="flex min-h-0 flex-grow">
          <div class="grid h-full w-full grid-cols-[2fr_3fr]">
            <div
              class="flex h-full min-h-0 items-center justify-center transition-opacity duration-500"
              classList={{ "opacity-0": !showHighscores() }}
            >
              <HighscoreList scores={highscores()} class="h-full w-100 max-w-full" />
            </div>
            <div class="flex flex-grow flex-col items-center justify-center gap-4">
              <For each={scoreData()}>
                {(data) => (
                  <ScoreCard
                    animatedStages={animatedStages()}
                    score={data.score}
                    player={data.player}
                    micColor={data.micColor}
                    position={data.position}
                  />
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="flex flex-shrink-0">
          <Button
            loading={updateHighscoresMutation.isPending}
            selected
            gradient={!roundStore.settings()?.returnTo ? "gradient-sing" : "gradient-party"}
            class="w-full"
            onClick={handleContinue}
          >
            {t("score.continue")}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

interface ScoreCardProps {
  score: Score;
  player: User;
  micColor: string;
  position: number;
  animatedStages: ScoreCategory[];
}

function ScoreCard(props: ScoreCardProps) {
  const getPercentage = (value: number) => (value / MAX_POSSIBLE_SCORE) * 100;

  const [animatedScores, setAnimatedScores] = createSignal<Score>({
    normal: 0,
    golden: 0,
    bonus: 0,
  });

  const [animatedPercentages, setAnimatedPercentages] = createSignal<Score>({
    normal: 0,
    golden: 0,
    bonus: 0,
  });

  const animatedTotalScore = () => {
    const scores = animatedScores();
    return Math.floor(scores.normal + scores.golden + scores.bonus);
  };

  const animateCounter = (
    startValue: number,
    endValue: number,
    setValue: (value: number) => void,
    duration: number
  ): ReturnType<typeof setInterval> => {
    const stepValue = (endValue - startValue) / ANIMATION_STEPS;
    const stepDuration = duration / ANIMATION_STEPS;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const newValue = startValue + stepValue * currentStep;
      setValue(currentStep < ANIMATION_STEPS ? Math.floor(newValue) : endValue);

      if (currentStep >= ANIMATION_STEPS) {
        clearInterval(interval);
      }
    }, stepDuration);

    return interval;
  };

  const animatePercentage = (startValue: number, endValue: number, setValue: (value: number) => void, duration: number): (() => void) => {
    const startTime = performance.now();
    let animationFrame: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeInOut curve for smoother animation
      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;

      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  };

  onMount(() => {
    const cleanupFunctions: (() => void)[] = [];

    // If there are no animated stages, show the full score immediately
    if (props.animatedStages.length === 0) {
      setAnimatedScores({
        normal: props.score.normal,
        golden: props.score.golden,
        bonus: props.score.bonus,
      });
      setAnimatedPercentages({
        normal: getPercentage(props.score.normal),
        golden: getPercentage(props.score.golden),
        bonus: getPercentage(props.score.bonus),
      });
      return;
    }

    // Animate each score category, with sufficient delay to ensure previous animations finish
    for (const [index, category] of props.animatedStages.entries()) {
      setTimeout(() => {
        const scoreValue = props.score[category];
        const targetPercentage = getPercentage(scoreValue);

        // Animate the score numbers (slower, stepped)
        animateCounter(0, scoreValue, (value) => setAnimatedScores((prev) => ({ ...prev, [category]: value })), ANIMATION_DURATION);

        // Animate the bar percentages (smooth, requestAnimationFrame)
        const cleanup = animatePercentage(
          0,
          targetPercentage,
          (value) => setAnimatedPercentages((prev) => ({ ...prev, [category]: value })),
          ANIMATION_DURATION
        );

        cleanupFunctions.push(cleanup);
      }, index * ANIMATION_DELAY);
    }

    // Register cleanup with SolidJS onCleanup
    onCleanup(() => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    });
  });

  return (
    <div
      class="flex w-140 flex-col gap-4 rounded-xl p-6 shadow-xl transition-all"
      style={{
        background: `linear-gradient(90deg, ${getColorVar(props.micColor, 600)}, ${getColorVar(props.micColor, 500)})`,
      }}
    >
      <div class="flex w-full items-center justify-between">
        <div class="flex items-center gap-3">
          <Avatar user={props.player} />
          <div class="font-bold text-lg text-white">{props.player.username}</div>
        </div>
        <div class="font-bold text-3xl text-white">{animatedTotalScore().toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
      </div>

      <div class="flex h-10 w-full overflow-hidden rounded-lg bg-black/20">
        <ScoreBar percentage={animatedPercentages().normal} color={getColorVar(props.micColor, 400)} />
        <ScoreBar percentage={animatedPercentages().golden} color={getColorVar(props.micColor, 300)} />
        <ScoreBar percentage={animatedPercentages().bonus} color={getColorVar(props.micColor, 50)} />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <ScoreDetail label={t("score.normal")} value={animatedScores().normal} color={getColorVar(props.micColor, 400)} />
        <ScoreDetail label={t("score.golden")} value={animatedScores().golden} color={getColorVar(props.micColor, 300)} />
        <ScoreDetail label={t("score.bonus")} value={animatedScores().bonus} color={getColorVar(props.micColor, 50)} />
      </div>
    </div>
  );
}

function ScoreBar(props: { percentage: number; color: string }) {
  return (
    <div
      class="flex h-full items-center justify-center font-medium text-white/90 text-xs"
      style={{
        width: `${props.percentage}%`,
        "background-color": props.color,
      }}
    />
  );
}

function ScoreDetail(props: { label: string; value: number; color: string }) {
  return (
    <div class="flex items-center gap-2 rounded-md bg-black/10 px-3 py-1.5">
      <div class="h-4 w-4 rounded-sm" style={{ "background-color": props.color }} />
      <div class="flex flex-col">
        <span class="text-white/70 text-xs">{props.label}</span>
        <span class="font-medium text-sm text-white">{props.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
