import { useNavigate } from "@tanstack/solid-router";
import { batch, createMemo, createSignal, For, type JSX, Show, untrack } from "solid-js";
import IconCrown from "~icons/ph/crown-simple-fill";
import IconDice from "~icons/ph/dice-five-fill";
import IconMusic from "~icons/ph/music-notes-fill";
import IconF1Key from "~icons/sing/f1-key";
import IconF2Key from "~icons/sing/f2-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SongPlayer from "~/components/song-player";
import { SongScroller, type SongScrollerRef } from "~/components/song-select/song-scroller";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import KeyGlyph from "~/components/ui/key-glyph";
import Panel from "~/components/ui/panel";
import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { formatNumber, t } from "~/lib/i18n";
import { buildDuelPlayers, partySongs, slotColor } from "~/lib/party/common";
import { NOT_ALLOWED, STALE, UNAVAILABLE, useRemoteSurface } from "~/lib/remote";
import { playSound } from "~/lib/sound";
import type { User } from "~/lib/types";
import { type LocalSong } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { type Round, versusStore } from "~/stores/party/versus";
import { useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

const SPIN_MS = 3000;
/** The reel is a short strip of random songs, not the whole library. */
const STRIP_LENGTH = 48;
/** Covers on either side of the centre that stay untouched when refilling (they're on screen). */
const KEEP_AROUND = 7;
/** A re-roll passes this many covers, plus a little random variance. */
const SPIN_STEPS = 16;
const SPIN_VARIANCE = 7;
/** Songs whose preview fails are re-rolled for free, up to this many in a row. */
const MAX_AUTO_REROLLS = 5;

const mod = (n: number, m: number) => ((n % m) + m) % m;

interface ReelSlot {
  id: string;
  song: LocalSong;
}
/** Up to this many jokers are shown as dice; more collapse into a counter. */
const MAX_DICE = 5;
const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-orange-400"];
const PIP_COLORS: Record<Round["result"], string> = { win: "bg-green-500", draw: "bg-yellow-500", lose: "bg-white/15" };
/** Latest rounds shown as W/L pips per player; older ones collapse into "+N". */
const FORM_ROUNDS = 3;

interface Standing {
  user: User;
  wins: number;
  played: number;
  totalScore: number;
  form: Round["result"][];
  rank: number;
}

/** Players ranked by wins (a draw counts as a win), then total score; equal players share a rank. */
function calculateStandings(players: User[], rounds: Record<string, Round[]>): Standing[] {
  const sorted = players
    .map((user) => {
      const played = rounds[user.id] ?? [];
      return {
        user,
        wins: played.filter((round) => round.result !== "lose").length,
        played: played.length,
        totalScore: played.reduce((sum, round) => sum + round.score, 0),
        form: played.map((round) => round.result),
      };
    })
    .toSorted((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);

  let rank = 0;
  return sorted.map((standing, index) => {
    const previous = sorted[index - 1];
    const tied = previous?.wins === standing.wins && previous.totalScore === standing.totalScore;
    if (!tied) rank = index + 1;
    return { ...standing, rank };
  });
}

export default function VersusScreen() {
  const navigate = useNavigate();
  const roundActions = useRoundActions();
  const onBack = () => navigate({ to: "/party/versus/settings" });

  const state = () => versusStore.state();
  const availableSongs = createMemo(() => {
    const failed = new Set(state().failedSongs);
    return partySongs().filter((song) => !failed.has(song.hash));
  });

  const randomUnplayedSong = (exclude?: LocalSong | null) => {
    const played = new Set(state().playedSongs.map((song) => song.hash));
    const others = availableSongs().filter((song) => song.hash !== exclude?.hash);
    const unplayed = others.filter((song) => !played.has(song.hash));
    const from = unplayed.length > 0 ? unplayed : others.length > 0 ? others : availableSongs();
    return from[Math.floor(Math.random() * from.length)] ?? null;
  };

  const randomSong = () => availableSongs()[Math.floor(Math.random() * availableSongs().length)];
  // Slot index in the id: a song may appear more than once, and refilled slots get fresh covers.
  const slot = (index: number, song: LocalSong): ReelSlot => ({ id: `${index}:${song.hash}`, song });

  // Picked once; later picks come from re-rolls. After a failed round this is already a new song for the same
  // matchup, as the failed one is never picked again.
  const initialSong = untrack(() => randomUnplayedSong());
  const [strip, setStrip] = createSignal<ReelSlot[]>(
    initialSong
      ? Array.from({ length: STRIP_LENGTH }, (_, index) => slot(index, index === 0 ? initialSong : randomSong()!))
      : [],
  );
  const [currentSong, setCurrentSong] = createSignal<LocalSong | null>(initialSong);
  const [centredIndex, setCentredIndex] = createSignal(0);
  const [spinning, setSpinning] = createSignal(false);
  let scroller: SongScrollerRef<ReelSlot> | undefined;

  const matchup = () => state().matchups[0] ?? null;
  const champion = () => !matchup();

  const standings = createMemo(() => calculateStandings(state().players, state().rounds));

  const maxJokers = versusStore.settings()?.jokers ?? 0;
  const [jokers, setJokers] = createSignal<[number, number]>([maxJokers, maxJokers]);

  // Free re-rolls in a row after a preview failed; reset once a preview plays or a joker is used.
  let autoRerolls = 0;

  /** The song a re-roll would land on, or null when there's nothing (else) to spin to right now. */
  const nextSong = () => {
    if (spinning() || !matchup()) return null;
    const next = randomUnplayedSong(currentSong());
    return next && next.hash !== currentSong()?.hash ? next : null;
  };

  const spinTo = async (next: LocalSong) => {
    if (!scroller) return;

    // Refill everything off screen with fresh songs and put the pick a set distance ahead.
    const steps = SPIN_STEPS + Math.floor(Math.random() * SPIN_VARIANCE);
    const centre = centredIndex();
    const refilled = strip().map((current, index) => {
      const ahead = mod(index - centre, STRIP_LENGTH);
      if (ahead === steps) return slot(index, next);
      if (ahead < KEEP_AROUND || ahead > STRIP_LENGTH - KEEP_AROUND) return current;
      return slot(index, randomSong() ?? current.song);
    });
    const target = refilled[mod(centre + steps, STRIP_LENGTH)]!;
    setStrip(refilled);
    // Warm the cache so the landing cover is there when the reel stops.
    if (next.coverUrl) new Image().src = next.coverUrl;

    setSpinning(true);
    await scroller.spinTo(target, effectsEnabled() ? SPIN_MS : 1);
    batch(() => {
      setCurrentSong(next);
      setSpinning(false);
    });
  };

  const reroll = async (player: 0 | 1) => {
    if (jokers()[player] <= 0) return;
    const next = nextSong();
    if (!next || !scroller) return;

    autoRerolls = 0;
    setJokers((current) => {
      const updated: [number, number] = [...current];
      updated[player] -= 1;
      return updated;
    });
    playSound("confirm");
    await spinTo(next);
  };

  // A song whose preview can't be played is broken: never pick it again and spin to another one without a joker.
  // Capped, so a library full of broken songs doesn't keep the reel spinning forever.
  const onPreviewError = (song: LocalSong) => {
    versusStore.markSongFailed(song);
    if (autoRerolls >= MAX_AUTO_REROLLS) return;
    const next = nextSong();
    if (!next) return;

    autoRerolls += 1;
    void spinTo(next);
  };

  const startRound = () => {
    const song = currentSong();
    const pair = matchup();
    if (!song || !pair || spinning()) return;

    const players = buildDuelPlayers(pair[0], pair[1], "versus");
    if (!players) return;

    playSound("confirm");
    roundActions.startRound({
      songs: [{ song, players, mode: "single", length: "full" }],
      returnTo: "/party/versus",
    });
  };

  // Confirm goes through the footer button (it fires on key up, with press feedback). Once there's a
  // champion, the menu handles input.
  useNavigation(() => ({
    actions: champion()
      ? {}
      : {
          back: onBack,
          "joker-1": () => void reroll(0),
          "joker-2": () => void reroll(1),
        },
  }));

  // The two singers spend their own jokers from their phones; everyone else sees who's up.
  useRemoteSurface({
    panel: (userId) => {
      const pair = matchup();
      if (!pair) return null;
      const song = spinning() ? null : currentSong();
      const songInfo = song ? { hash: song.hash, title: song.title, artist: song.artist } : null;
      const name = (user: User) => user.username ?? "?";

      const slot = pair.findIndex((user) => user.id === userId);
      if (slot !== 0 && slot !== 1) {
        return { panel: { kind: "versus.watch", players: [name(pair[0]), name(pair[1])], song: songInfo } };
      }
      const other = slot === 0 ? 1 : 0;
      return {
        panel: {
          kind: "versus",
          slot,
          color: slotColor(slot),
          jokers: jokers()[slot],
          maxJokers,
          opponent: { name: name(pair[other]), jokers: jokers()[other] },
          canReroll: jokers()[slot] > 0 && !spinning() && availableSongs().length > 1,
          song: songInfo,
        },
        attention: true,
      };
    },
    act: (userId, action) => {
      if (action.type !== "versus.reroll") return UNAVAILABLE;
      const slot = matchup()?.findIndex((user) => user.id === userId);
      if (slot !== 0 && slot !== 1) return NOT_ALLOWED;
      if (jokers()[slot] <= 0 || !nextSong()) return STALE;
      void reroll(slot);
      return { ok: true };
    },
  });

  const menuItems: MenuItem[] = [
    { type: "button", label: t("party.versus.continue"), action: () => versusStore.continueRound() },
    { type: "button", label: t("party.versus.exit"), action: onBack },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.versus.title")} onBack={onBack} />}
      footer={
        <div class="flex items-center justify-between gap-8">
          <KeyHints hints={["back", "confirm"]} />
          <Show when={!champion()}>
            <Button
              selected
              size="sm"
              gradient="gradient-party"
              class="w-[16cqw]"
              loading={spinning()}
              onClick={startRound}
            >
              {t("party.versus.start")}
            </Button>
          </Show>
        </div>
      }
      background={
        <Show when={!champion() && !spinning() && currentSong()} keyed>
          {(song) => (
            <div class="h-full w-full animate-[hide_0.4s_ease-out_reverse_both]">
              <SongPlayer
                mode="preview"
                volume={settingsStore.getVolume("preview")}
                class="h-full w-full opacity-40"
                playing
                song={song}
                onCanPlayThrough={() => (autoRerolls = 0)}
                onError={() => onPreviewError(song)}
              />
            </div>
          )}
        </Show>
      }
    >
      <Show when={!champion()} fallback={<Champion standings={standings()} menuItems={menuItems} onBack={onBack} />}>
        <div class="flex h-full min-h-0 items-center gap-8 select-none">
          <Scoreboard
            standings={standings()}
            highlight={matchup()?.map((user) => String(user.id)) ?? []}
            class="w-[32cqw] shrink-0"
          />

          <div class="flex h-full min-w-0 grow flex-col items-center justify-center gap-[2cqh]">
            <Show when={matchup()}>
              {(pair) => (
                <div class="flex w-full items-center justify-center gap-4">
                  <PlayerCard
                    user={pair()[0]}
                    index={0}
                    color={slotColor(0)}
                    jokers={jokers()[0]}
                    maxJokers={maxJokers}
                    onReroll={() => void reroll(0)}
                  />
                  <span class="w-[13cqw] text-center text-9xl leading-none font-black tracking-tight text-yellow-300">
                    VS
                  </span>
                  <PlayerCard
                    user={pair()[1]}
                    index={1}
                    color={slotColor(1)}
                    jokers={jokers()[1]}
                    maxJokers={maxJokers}
                    onReroll={() => void reroll(1)}
                  />
                </div>
              )}
            </Show>

            <div
              // Height follows the covers (sized from the width), plus room for the centred one's lift.
              class="relative aspect-[5] max-h-[22cqh] w-full [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]"
            >
              <SongScroller
                ref={scroller}
                items={strip()}
                getId={(reelSlot) => reelSlot.id}
                initialId={strip()[0]?.id}
                interactive={false}
                class="h-full"
                itemSize={0.15}
                onCenteredItemChange={(_, index) => setCentredIndex(index)}
                onConfirm={() => startRound()}
              >
                {(reelSlot, _index, item) => (
                  <ReelCover
                    song={reelSlot.song}
                    emphasis={item().emphasis}
                    // Only the picked cover can be clicked (to start the round).
                    clickable={Math.abs(item().offset) < 0.5 && !spinning()}
                  />
                )}
              </SongScroller>
            </div>

            {/* Out of the flow and top-anchored: titles of any length never move the stage. */}
            <div class="relative h-[5cqw] w-full shrink-0">
              <Show when={!spinning() && currentSong()} keyed>
                {(song) => (
                  <div
                    class="absolute inset-x-0 top-0 flex flex-col items-center text-center"
                    classList={{ "animate-title-in": effectsEnabled() }}
                  >
                    <span class="text-xl font-semibold">{song.artist}</span>
                    <span class="line-clamp-1 pb-[0.1em] text-5xl leading-tight font-extrabold tracking-tight">
                      {song.title}
                    </span>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Layout>
  );
}

interface PlayerCardProps {
  user: User;
  index: 0 | 1;
  color: string;
  jokers: number;
  maxJokers: number;
  onReroll: () => void;
}

/** A player's face-off card, filled with their mic colour (gradient mirrored for the right player). */
function PlayerCard(props: PlayerCardProps) {
  const color = (shade: 400 | 700 | 800) => getColorVar(props.color, shade);

  return (
    <Panel
      // Fixed proportions, capped by the height so wide screens don't overflow; `--card` sizes the contents.
      class="flex aspect-[0.925] h-(--card) flex-col items-center justify-center gap-4 px-4 pt-4 pb-5 [--card:min(19.5cqw,30cqh)]"
      surface="overflow-hidden rounded-[1.6cqw] ring-[0.22cqw] ring-white/80 ring-inset"
      surfaceStyle={{
        background: `linear-gradient(${props.index ? "200deg" : "160deg"}, ${color(400)}, ${color(800)})`,
        "box-shadow": "0 0.15cqw 0 rgb(0 0 0 / 0.3)",
      }}
    >
      <div class="mt-auto size-[calc(var(--card)*0.36)]">
        <Avatar user={props.user} class="h-full w-full" />
      </div>
      <span
        class="max-w-full truncate px-2 leading-tight font-black tracking-tight"
        // Long names shrink to fit the card; only extreme ones get truncated.
        style={{
          "font-size": `calc(var(--card) * ${Math.min(0.174, 0.97 / Math.max(props.user.username?.length ?? 1, 1)).toFixed(3)})`,
        }}
      >
        {props.user.username}
      </span>
      <div class="mt-auto flex h-8 items-center">
        <Jokers
          count={props.jokers}
          max={props.maxJokers}
          mirrored={props.index === 1}
          hint={
            props.index === 0 ? (
              <KeyGlyph keyboard={IconF1Key} gamepad={IconGamepadLB} />
            ) : (
              <KeyGlyph keyboard={IconF2Key} gamepad={IconGamepadRB} />
            )
          }
          onClick={props.onReroll}
        />
      </div>
    </Panel>
  );
}

/** Joker dice (used ones dimmed), with the key hint on the card's outer side. */
function Jokers(props: { count: number; max: number; hint: JSX.Element; mirrored: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      class="flex cursor-pointer items-center gap-2 transition-transform active:scale-95"
      classList={{ "flex-row-reverse": props.mirrored }}
      onClick={() => props.onClick()}
      aria-label={t("party.versus.jokers")}
    >
      <span class="flex text-xl opacity-80">{props.hint}</span>
      <Show
        when={props.max <= MAX_DICE}
        fallback={
          <span class="flex items-center gap-1.5 text-xl font-black" classList={{ "opacity-40": props.count === 0 }}>
            <IconDice class="text-2xl" />×{props.count}
          </span>
        }
      >
        <span class="flex gap-1" classList={{ "flex-row-reverse": props.mirrored }}>
          <For each={Array.from({ length: props.max }, (_, i) => i)}>
            {(i) => (
              <IconDice
                class="text-2xl transition-[color,scale,filter] duration-300"
                classList={{ "text-white drop-shadow": i < props.count, "scale-75 text-white/20": i >= props.count }}
              />
            )}
          </For>
        </span>
      </Show>
    </button>
  );
}

/** Full standings: rank, player, per-round form, wins/played and total score. */
function Scoreboard(props: { standings: Standing[]; highlight: string[]; class?: string }) {
  return (
    <div class={`flex max-h-full min-h-0 flex-col gap-1.5 ${props.class ?? ""}`}>
      <div class="flex items-center gap-2.5 px-5 pb-1 text-xs font-bold tracking-[0.15em] text-white/50 uppercase">
        <span class="grow">{t("party.versus.standings")}</span>
        <span class="w-[3.5cqw] shrink-0 text-center">{t("party.versus.winsColumn")}</span>
        <span class="w-[5cqw] shrink-0 text-right">{t("party.versus.score")}</span>
      </div>
      <div class="styled-scrollbars flex min-h-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto px-2 py-1">
        <For each={props.standings}>
          {(standing) => (
            <div
              class="flex h-11 shrink-0 items-center gap-2.5 rounded-[0.9cqw] bg-black/35 px-3 backdrop-blur-sm"
              classList={{
                "ring-[0.15cqw] ring-white/70 ring-inset": props.highlight.includes(String(standing.user.id)),
              }}
            >
              <span
                class={`flex w-5 shrink-0 justify-center text-lg font-black ${RANK_COLORS[standing.rank - 1] ?? "text-white/60"}`}
              >
                {/* The leader (or leaders, when tied) get the crown instead of the number. */}
                <Show when={standing.rank === 1 && standing.played > 0} fallback={standing.rank}>
                  <IconCrown />
                </Show>
              </span>
              <Avatar user={standing.user} class="h-7 w-7 shrink-0" />
              {/* Room for ~14 characters; only unusually long names get cut */}
              <span class="min-w-0 grow truncate font-bold">{standing.user.username}</span>
              {/* Fixed width, left-aligned, so pips line up across rows */}
              <span class="flex shrink-0 items-center gap-1">
                <span class="w-6 text-right text-xs font-black text-white/50 tabular-nums">
                  <Show when={standing.form.length > FORM_ROUNDS}>+{standing.form.length - FORM_ROUNDS}</Show>
                </span>
                <span class="flex w-[3.25cqw] gap-0.5">
                  <For each={standing.form.slice(-FORM_ROUNDS)}>
                    {(result) => (
                      <span
                        class={`flex h-5 w-4 items-center justify-center rounded-[0.3cqw] text-[0.6cqw] font-black ${PIP_COLORS[result]}`}
                      >
                        {t(`party.versus.form.${result === "win" ? "win" : result === "draw" ? "draw" : "loss"}`)}
                      </span>
                    )}
                  </For>
                </span>
              </span>
              <span class="w-[3.5cqw] shrink-0 text-center font-black tabular-nums">
                {standing.wins}/{standing.played}
              </span>
              <span class="w-[5cqw] shrink-0 text-right font-black tabular-nums">
                {formatNumber(standing.totalScore)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

const PODIUM = [
  // Revealed 3rd, 2nd, then 1st.
  { place: 2, height: "h-[16cqh]", colors: "from-slate-200 to-slate-500", delay: "[animation-delay:300ms]" },
  { place: 1, height: "h-[24cqh]", colors: "from-yellow-300 to-yellow-600", delay: "[animation-delay:600ms]" },
  { place: 3, height: "h-[10cqh]", colors: "from-orange-300 to-orange-600", delay: "" },
];

/** End of a versus session: the top three on a podium. */
function Champion(props: { standings: Standing[]; menuItems: MenuItem[]; onBack: () => void }) {
  const byPlace = (place: number) => props.standings.filter((standing) => standing.rank === place);
  const winners = () => byPlace(1);

  return (
    <div class="flex h-full flex-col items-center justify-center gap-6">
      <span class="text-6xl text-display text-yellow-300" classList={{ "animate-slam": effectsEnabled() }}>
        <Show when={winners().length === 1} fallback={t("party.versus.draw")}>
          {t("party.versus.winner", { name: winners()[0]?.user.username ?? "" })}
        </Show>
      </span>
      <div class="flex items-end gap-4">
        <For each={PODIUM.filter((step) => byPlace(step.place).length > 0)}>
          {(step) => (
            <div
              class={`flex w-[14cqw] flex-col items-center gap-2 ${step.delay}`}
              classList={{ "animate-lane-in": effectsEnabled() }}
            >
              <Show when={step.place === 1}>
                <IconCrown class="text-[4cqw] text-yellow-300 drop-shadow-lg" />
              </Show>
              <div class="flex -space-x-3">
                <For each={byPlace(step.place)}>
                  {(standing) => (
                    <div classList={{ "size-[5cqw]": step.place === 1, "size-[3.5cqw]": step.place !== 1 }}>
                      <Avatar user={standing.user} class="h-full w-full" />
                    </div>
                  )}
                </For>
              </div>
              <span class="max-w-full truncate text-2xl text-display">
                {byPlace(step.place)
                  .map((standing) => standing.user.username)
                  .join(" & ") || "—"}
              </span>
              <div
                class={`flex w-full items-start justify-center rounded-t-[1.4cqw] bg-linear-to-b pt-3 shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)] ${step.colors} ${step.height}`}
              >
                <span class="text-6xl text-display text-white [--display-shadow:rgb(0_0_0/0.25)]">{step.place}</span>
              </div>
            </div>
          )}
        </For>
      </div>
      <Menu gradient="gradient-party" class="!h-auto max-w-160" items={props.menuItems} onBack={props.onBack} />
    </div>
  );
}

/** A cover on the reel: the picked (centred) one lifts, brightens and gets a white outline. */
function ReelCover(props: { song: LocalSong; emphasis: number; clickable: boolean }) {
  return (
    <button
      type="button"
      aria-label={props.song.title}
      class="relative aspect-square w-[84%]"
      classList={{
        "cursor-pointer active:scale-95 active:transition-transform active:duration-250": props.clickable,
        "cursor-default": !props.clickable,
      }}
    >
      {/* Emphasis changes every frame of the spin: move and fade layers only (dark overlay instead of
          a brightness filter, a separate outline instead of a growing one). */}
      <div class="relative h-full w-full" style={{ transform: `translateY(${-props.emphasis * 0.6}cqw)` }}>
        <div class="relative h-full w-full overflow-hidden rounded-[0.8cqw] bg-black">
          <Show
            when={props.song.coverUrl}
            fallback={
              <div class="flex h-full w-full items-center justify-center bg-white/8">
                <IconMusic class="text-4xl opacity-25" />
              </div>
            }
          >
            {(url) => (
              <img
                class="h-full w-full object-cover"
                src={url()}
                alt={props.song.title}
                draggable={false}
                decoding="async"
              />
            )}
          </Show>
          <div class="absolute inset-0 bg-black" style={{ opacity: 0.4 * (1 - props.emphasis) }} />
        </div>
        {/* Fades in as the cover reaches the centre. */}
        <div
          class="pointer-events-none absolute inset-0 rounded-[0.8cqw] outline-[0.22cqw] outline-white outline-solid"
          style={{ opacity: props.emphasis }}
        />
      </div>
    </button>
  );
}
