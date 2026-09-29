import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import type { PlayerResult } from "~/lib/game/round-results";
import { t } from "~/lib/i18n";
import { getColorVar } from "~/lib/utils/color";
import type { TierId } from "~/lib/utils/score";

import TagChip from "../fx/tag-chip";
import Avatar from "../ui/avatar";
import RankArt from "./rank-art";

export type LaneSize = "lg" | "md" | "sm";

interface ScoreLaneProps {
  result: PlayerResult;
  /** The score shown right now; the screen animates it from 0 to the total. */
  shownScore: number;
  maxScore: number;
  size: LaneSize;
  /** Position in the list, for the staggered entrance. */
  index: number;
  tierRevealed: boolean;
  statsRevealed: boolean;
  newRecord: boolean;
  winner: boolean;
  /** Show everything in its final state without entrance animations. */
  instant: boolean;
}

// Every row has a fixed height so revealing the tier or stats never moves anything.
const NAME_LINE = { lg: "h-12 text-xl", md: "h-10 text-xl", sm: "h-9 text-lg" } as const;
const BAR_HEIGHT = { lg: "min(11cqh, 6cqw)", md: "min(8cqh, 4.5cqw)", sm: "min(5.2cqh, 3cqw)" } as const;
const SCORE_TEXT = { lg: "text-6xl", md: "text-5xl", sm: "text-4xl" } as const;
const STATS_ROW = { lg: "h-7 text-base", md: "h-7 text-sm", sm: "h-6 text-xs" } as const;
/** Sticker height relative to the bar: tall solo bars need less, thin four-player bars a bit more. */
const STICKER_SCALE = { lg: 1.2, md: 1.35, sm: 1.35 } as const;
const AVATAR = { lg: "h-10 w-10", md: "h-8 w-8", sm: "h-7 w-7" } as const;

/** One player's result: name line, a score bar that fills like a race, and stats. */
export default function ScoreLane(props: ScoreLaneProps) {
  const animate = () => !props.instant && effectsEnabled();
  const color = (shade: 400 | 700 | 800) => getColorVar(props.result.micColor, shade);
  const fill = () => (props.maxScore > 0 ? (props.shownScore / props.maxScore) * 100 : 0);

  const scoreText = () => (
    <span
      class={`inline-block skew-x-12 leading-none text-display tabular-nums ${SCORE_TEXT[props.size]}`}
      style={{ "--display-shadow": color(800) }}
    >
      {Math.floor(props.shownScore).toLocaleString("en-US")}
    </span>
  );

  const stats = () => {
    const { maxCombo, perfectPhrases, goldenNotesHit, goldenNotesTotal } = props.result.stats;
    return [
      { label: t("score.maxCombo"), value: String(maxCombo), color: color(700) },
      // Just the count: a total would only cover lines reached, which misleads when a song ends early.
      { label: t("score.perfectPhrases"), value: String(perfectPhrases), color: color(700) },
      ...(goldenNotesTotal > 0
        ? [
            {
              label: t("score.goldenNotes"),
              value: `${Math.round((goldenNotesHit / goldenNotesTotal) * 100)}%`,
              color: "var(--color-yellow-600)",
            },
          ]
        : []),
    ];
  };

  // Rank name placement: centred over the sticker, but after the player name and inside the lane.
  let lane: HTMLDivElement | undefined;
  let nameLine: HTMLDivElement | undefined;
  let nameEnd: HTMLSpanElement | undefined;
  let rankLabel: HTMLDivElement | undefined;
  let sticker: HTMLDivElement | undefined;
  const [rankLeft, setRankLeft] = createSignal(-1);
  const placeRank = () => {
    if (!nameLine || !nameEnd || !rankLabel || !sticker) return;
    const line = nameLine.getBoundingClientRect();
    const art = sticker.getBoundingClientRect();
    const labelWidth = rankLabel.offsetWidth;
    const gap = 16;
    const minLeft = nameEnd.getBoundingClientRect().left - line.left + gap;
    // Up to the lane's outer edge, using the room reserved for the sticker on full bars.
    const laneRight = lane?.getBoundingClientRect().right ?? line.right;
    const maxLeft = laneRight - line.left - labelWidth;
    const centred = art.left + art.width / 2 - line.left - labelWidth / 2;
    setRankLeft(Math.max(minLeft, Math.min(centred, maxLeft)));
  };
  createEffect(
    on(
      () => props.tierRevealed,
      (revealed) => revealed && requestAnimationFrame(placeRank),
    ),
  );
  onMount(() => {
    const observer = new ResizeObserver(() => props.tierRevealed && placeRank());
    if (nameLine) observer.observe(nameLine);
    onCleanup(() => observer.disconnect());
  });

  return (
    // Room on the right for the rank sticker on nearly full bars.
    <div ref={lane} class="w-full pr-[5cqw]">
      <div
        class="flex min-w-0 flex-col"
        classList={{ "gap-2": props.size !== "sm", "gap-1": props.size === "sm", "animate-lane-in": animate() }}
        style={{ "animation-delay": `${props.index * 90}ms` }}
      >
        <div ref={nameLine} class={`relative flex min-w-0 shrink-0 items-center gap-3 ${NAME_LINE[props.size]}`}>
          <Avatar user={props.result.player} class={AVATAR[props.size]} />
          <span class="max-w-[14cqw] truncate font-bold">{props.result.player.username}</span>
          <Show when={props.newRecord}>
            <div classList={{ "animate-stamp": animate() }} style={{ "--stamp-rotate": "-4deg" }}>
              <TagChip label={t("score.newRecord")} class="text-sm" accentColor="var(--color-yellow-500)" />
            </div>
          </Show>
          <span ref={nameEnd} class="h-full w-0" />
          {/* Rank name, centred above the sticker (pushed right only if the player name is in the way) */}
          <Show when={props.tierRevealed}>
            <div
              ref={rankLabel}
              class="absolute top-0 flex h-full items-center"
              style={{ left: `${rankLeft()}px`, visibility: rankLeft() < 0 ? "hidden" : undefined }}
            >
              <div classList={{ "animate-title-in [animation-delay:250ms]": animate() }}>
                <TierName tier={props.result.tier} />
              </div>
            </div>
          </Show>
        </div>

        <div class="relative" style={{ height: BAR_HEIGHT[props.size] }}>
          {/* Track and fill */}
          <div
            class="absolute inset-0 -skew-x-12 overflow-hidden rounded-md bg-black/35"
            classList={{ "animate-winner-glow": props.winner && effectsEnabled() }}
          >
            <div
              class="h-full"
              style={{
                width: `${Math.max(fill(), 3)}%`,
                background: `linear-gradient(90deg, ${color(700)}, ${color(400)})`,
              }}
            />
            {/* Tune Perfect line */}
            <div class="absolute inset-y-0 right-[5%] w-[0.3cqw] bg-yellow-300/70" />
          </div>

          {/* Number and sticker ride on top. The number's box is as wide as the fill but never
              narrower than the number, so it starts at the left and only moves once the fill
              can carry it; the sticker always follows whichever ends further right. */}
          <div class="absolute inset-0 flex -skew-x-12 items-center">
            <div
              class="flex h-full shrink-0 items-center justify-end px-4"
              style={{ width: `${Math.max(fill(), 3)}%`, "min-width": "max-content" }}
            >
              {scoreText()}
            </div>
            <Show when={props.tierRevealed}>
              <div class="relative h-full w-0">
                <div
                  ref={sticker}
                  class="pointer-events-none absolute top-1/2 left-0 z-10 -translate-x-[4%] -translate-y-1/2 skew-x-12"
                  style={{ height: `calc(${BAR_HEIGHT[props.size]} * ${STICKER_SCALE[props.size]})` }}
                >
                  <div class="h-full rotate-[-8deg]" classList={{ "animate-slap": animate() }}>
                    <RankArt tier={props.result.tier} animated={effectsEnabled()} class="aspect-square h-full" />
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>

        <div class={`flex shrink-0 flex-wrap gap-2 ${STATS_ROW[props.size]}`}>
          <Show when={props.statsRevealed}>
            <For each={stats()}>
              {(stat, statIndex) => (
                <div
                  classList={{ "animate-title-in": animate() }}
                  style={{ "animation-delay": `${props.index * 60 + statIndex() * 90}ms` }}
                >
                  <TagChip label={stat.label} accent={stat.value} accentColor={stat.color} />
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

function TierName(props: { tier: TierId }) {
  const gold = () => props.tier === "s" || props.tier === "splus";
  return (
    <span
      class="pr-[0.2em] text-[1.2em] leading-none text-display whitespace-nowrap"
      classList={{ "text-yellow-300": gold(), "text-white": !gold() }}
    >
      {t(`score.tiers.${props.tier}`)}
    </span>
  );
}
