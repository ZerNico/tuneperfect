import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import IconCrown from "~icons/ph/crown-fill";
import IconSparkle from "~icons/ph/sparkle-fill";

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
const STATS_ROW = { lg: "h-8 text-lg", md: "h-8 text-base", sm: "h-6 text-sm" } as const;
/** Sticker height relative to the bar: tall solo bars need less, thin four-player bars a bit more. */
const STICKER_SCALE = { lg: 1.2, md: 1.35, sm: 1.35 } as const;
const AVATAR = { lg: "h-10 w-10", md: "h-8 w-8", sm: "h-7 w-7" } as const;

/** Winner sparkles around the sticker: position and size relative to it, twinkle delay in seconds. */
const SPARKLES = [
  { x: 142, y: 4, size: 0.24, delay: 0 },
  { x: 140, y: 62, size: 0.2, delay: 0.5 },
  { x: -22, y: 112, size: 0.18, delay: 1 },
  { x: 62, y: 124, size: 0.16, delay: 1.4 },
  { x: 172, y: 26, size: 0.14, delay: 0.8 },
  { x: 112, y: 112, size: 0.22, delay: 1.8 },
] as const;

/** One player's result: name line, a score bar that fills like a race, and stats. */
export default function ScoreLane(props: ScoreLaneProps) {
  const animate = () => !props.instant && effectsEnabled();
  const color = (shade: 400 | 700 | 900) => getColorVar(props.result.micColor, shade);
  const fill = () => (props.maxScore > 0 ? (props.shownScore / props.maxScore) * 100 : 0);

  const scoreText = () => (
    <span
      class={`inline-block leading-none text-display tabular-nums ${SCORE_TEXT[props.size]}`}
      style={{ "--display-shadow": color(900) }}
    >
      {Math.floor(props.shownScore).toLocaleString("en-US")}
    </span>
  );

  const stats = () => {
    const { maxCombo, perfectPhrases, goldenNotesHit, goldenNotesTotal } = props.result.stats;
    return [
      { label: t("score.maxCombo"), value: String(maxCombo) },
      // Just the count: a total would only cover lines reached, which misleads when a song ends early.
      { label: t("score.perfectPhrases"), value: String(perfectPhrases) },
      ...(goldenNotesTotal > 0
        ? [
            {
              label: t("score.goldenNotes"),
              value: `${Math.round((goldenNotesHit / goldenNotesTotal) * 100)}%`,
              color: "var(--color-yellow-300)",
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
  // The crown and the new-record chip arrive later and can push the name's end to the right.
  createEffect(
    on(
      () => [props.tierRevealed, props.winner, props.newRecord],
      () => props.tierRevealed && requestAnimationFrame(placeRank),
    ),
  );
  onMount(() => {
    const observer = new ResizeObserver(() => props.tierRevealed && placeRank());
    if (nameLine) observer.observe(nameLine);
    onCleanup(() => observer.disconnect());
  });

  return (
    // Room on the right for the rank sticker on nearly full bars.
    <div ref={lane} class="isolate w-full pr-[5cqw]">
      <div
        class="flex min-w-0 flex-col"
        classList={{ "gap-2": props.size !== "sm", "gap-1": props.size === "sm", "animate-lane-in": animate() }}
        style={{ "animation-delay": `${props.index * 90}ms` }}
      >
        <div ref={nameLine} class={`relative flex min-w-0 shrink-0 items-center gap-3 ${NAME_LINE[props.size]}`}>
          <Avatar user={props.result.player} class={AVATAR[props.size]} />
          <span class="max-w-[14cqw] truncate font-bold">{props.result.player.username}</span>
          <Show when={props.winner}>
            <IconCrown class="shrink-0 text-yellow-300" classList={{ "animate-pop-in": animate() }} />
          </Show>
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
          {/* Winner spotlight: a soft warm light behind the lane, strongest around the sticker and
              large enough to fade out long before its box ends. */}
          <div
            class="pointer-events-none absolute top-1/2 -z-10 h-[24cqw] w-[36cqw] -translate-1/2 bg-[radial-gradient(closest-side,rgb(253_224_71/0.26),rgb(253_224_71/0.08)_55%,transparent)] transition-opacity duration-700"
            classList={{ "opacity-0": !props.winner }}
            style={{ left: `calc(${Math.max(fill(), 3)}% + 3cqw)` }}
          />

          {/* Track and fill */}
          <div
            class="absolute inset-0 overflow-hidden rounded-[0.8cqw] bg-black/35 transition-shadow duration-700"
            classList={{ "shadow-[0_0_2cqw_-0.6cqw_rgb(253_224_71/0.6)]": props.winner }}
          >
            <div
              class="relative h-full overflow-hidden rounded-[0.8cqw]"
              style={{
                width: `${Math.max(fill(), 3)}%`,
                background: `linear-gradient(90deg, ${color(700)}, ${color(400)})`,
              }}
            >
              <div
                class="absolute inset-0 bg-stripes opacity-[0.12]"
                classList={{ "animate-stripes-move": effectsEnabled() }}
              />
              {/* Shine on top and a bright leading edge */}
              <div class="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/20 to-transparent" />
              <div class="absolute inset-y-0 right-0 w-[6cqw] max-w-full bg-linear-to-l from-white/40 to-transparent" />
            </div>
            {/* Tune Perfect line */}
            <div class="absolute inset-y-0 right-[5%] w-[0.25cqw] bg-yellow-300/70" />
          </div>

          {/* Number and sticker ride on top. The number's box is as wide as the fill but never
              narrower than the number, so it starts at the left and only moves once the fill
              can carry it; the sticker always follows whichever ends further right. */}
          <div class="absolute inset-0 flex items-center">
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
                  class="pointer-events-none absolute top-1/2 left-0 z-10 -translate-x-[4%] -translate-y-1/2"
                  style={{ height: `calc(${BAR_HEIGHT[props.size]} * ${STICKER_SCALE[props.size]})` }}
                >
                  <div class="h-full rotate-[-8deg]" classList={{ "animate-slap": animate() }}>
                    <RankArt tier={props.result.tier} animated={effectsEnabled()} class="aspect-square h-full" />
                  </div>
                  <Show when={props.winner}>
                    <For each={SPARKLES}>
                      {(sparkle) => (
                        <IconSparkle
                          class="absolute -translate-1/2 text-yellow-200 drop-shadow-[0_0_0.6cqw_rgb(253_224_71/0.8)]"
                          classList={{ "animate-sparkle": effectsEnabled() }}
                          style={{
                            left: `${sparkle.x}%`,
                            top: `${sparkle.y}%`,
                            "font-size": `calc(${BAR_HEIGHT[props.size]} * ${STICKER_SCALE[props.size] * sparkle.size * 1.6})`,
                            "animation-delay": `${sparkle.delay}s`,
                            opacity: effectsEnabled() ? undefined : 0.85,
                          }}
                        />
                      )}
                    </For>
                  </Show>
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
                  <StatChip label={stat.label} value={stat.value} color={stat.color} />
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

/** Rank name as a boxed chip: gold for the top ranks, white otherwise. */
function TierName(props: { tier: TierId }) {
  const gold = () => props.tier === "s" || props.tier === "splus";
  return (
    <span
      class="block rounded-[0.4cqw] px-[0.6cqw] py-[0.1cqw] text-[0.85em] leading-tight font-black tracking-[0.06em] whitespace-nowrap text-slate-900 uppercase"
      classList={{ "bg-yellow-300": gold(), "bg-white": !gold() }}
    >
      {t(`score.tiers.${props.tier}`)}
    </span>
  );
}

/** Quiet stat chip: muted label, bold value. */
function StatChip(props: { label: string; value: string; color?: string }) {
  return (
    <div class="flex h-full items-center gap-[0.5em] rounded-[0.5cqw] bg-black/30 px-[0.7em] whitespace-nowrap">
      <span class="font-semibold text-white/65">{props.label}</span>
      <span class="font-black tabular-nums" style={{ color: props.color }}>
        {props.value}
      </span>
    </div>
  );
}
