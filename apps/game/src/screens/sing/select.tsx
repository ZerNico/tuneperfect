import { useQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js";
import IconPlus from "~icons/ph/plus-bold";

import TagChip from "~/components/fx/tag-chip";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { select, type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { popup } from "~/lib/popup";
import { lobbyQueryOptions } from "~/lib/queries";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import type { GuestUser, User } from "~/lib/types";
import type { Song } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { getVoiceName, isDuet } from "~/lib/utils/song";
import { isGuestUser } from "~/lib/utils/user";
import { lobbyStore } from "~/stores/lobby";
import { medleyStore } from "~/stores/medley";
import { type PlayerSelection, type RoundLength, useRoundActions } from "~/stores/round";
import { selectionStore } from "~/stores/selection";
import { type Microphone, settingsStore } from "~/stores/settings";

const LENGTH_OPTIONS: RoundLength[] = ["full", "medium", "short"];

const getLengthLabel = (length: RoundLength) => {
  switch (length) {
    case "full":
      return t("sing.length.full");
    case "medium":
      return t("sing.length.medium");
    case "short":
      return t("sing.length.short");
  }
};

interface Selection {
  player: User;
  voice: number;
}

const [slotSelections, setSlotSelections] = createSignal<(Selection | undefined)[]>([]);
const [singleLength, setSingleLength] = createSignal<RoundLength>("full");
const [medleyLength, setMedleyLength] = createSignal<RoundLength>("short");

export default function PlayerSelectionScreen() {
  const playerSlotLoop = createLoop(settingsStore.microphones().length);
  const roundActions = useRoundActions();

  const navigate = useNavigate();

  const songs = createMemo(() => selectionStore.songs());

  // No staged songs (e.g. refresh/deep-link) — go back.
  createEffect(() => {
    if (songs().length === 0) {
      navigate({ to: "/sing", replace: true });
    }
  });

  const isMedley = createMemo(() => selectionStore.mode() === "medley");

  const selectedLength = () => (isMedley() ? medleyLength() : singleLength());
  const setSelectedLength = (length: RoundLength) => {
    if (isMedley()) {
      setMedleyLength(length);
    } else {
      setSingleLength(length);
    }
  };

  const initializeSlotSelections = () => {
    const micCount = settingsStore.microphones().length;
    const song = songs().length === 1 ? songs()[0] : null;
    const maxVoice = song ? song.voices.length - 1 : 0;

    setSlotSelections((prev) => {
      const next: (Selection | undefined)[] = Array.from({ length: micCount }, (_, i) => {
        const existing = prev[i];
        if (!existing) return undefined;

        const validVoice = Math.min(existing.voice, maxVoice);
        return { ...existing, voice: validVoice };
      });

      return next;
    });
  };

  createEffect(
    on([songs, () => settingsStore.microphones().length], () => {
      initializeSlotSelections();
    }),
  );

  const getSlotSelection = (index: number) => slotSelections()[index] ?? null;

  const setSlotSelection = (index: number, selection: Selection | null) => {
    setSlotSelections((prev) => {
      const next = [...prev];

      if (selection) {
        if (!isGuestUser(selection.player)) {
          for (let i = 0; i < next.length; i++) {
            const existingSelection = next[i];
            if (i !== index && existingSelection && existingSelection.player.id === selection.player.id) {
              next[i] = undefined;
            }
          }
        }
        next[index] = selection;
      } else {
        next[index] = undefined;
      }

      return next;
    });
  };

  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/sing" });
  };

  const hasAnyPlayer = createMemo(() => slotSelections().some((selection) => selection !== undefined));

  const startGame = () => {
    if (!hasAnyPlayer()) {
      notify({
        message: t("select.playerRequired"),
        intent: "error",
      });
      return;
    }

    const players: PlayerSelection[] = [];
    for (const [index, selection] of slotSelections().entries()) {
      const microphone = settingsStore.microphones()[index];
      if (selection && microphone) {
        players.push({ player: selection.player, voice: selection.voice, microphone });
      }
    }

    const length = selectedLength();

    if (isMedley()) {
      const queuedSongs = songs().map((song) => {
        const voiceCount = song.voices.length;
        const medleyPlayers = players.map((p, i) => ({
          ...p,
          voice: i % voiceCount,
        }));
        return { song, players: medleyPlayers, mode: "medley" as const, length };
      });
      roundActions.startRound({ songs: queuedSongs });
      medleyStore.clear();
    } else {
      const song = songs()[0];
      if (!song) return;
      roundActions.startRound({ songs: [{ song, players, mode: "single", length }] });
    }
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("select.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
      background={
        <Show when={!isMedley() && songs()[0]} fallback={<div />}>
          {(song) => (
            <div class="h-full w-full bg-black">
              <img class="h-full w-full object-cover opacity-50" src={song().coverUrl ?? ""} alt={song().title} />
              <div class="absolute inset-0 z-1 backdrop-blur-2xl will-change-[backdrop-filter]" />
            </div>
          )}
        </Show>
      }
    >
      <div class="flex h-full flex-col items-center justify-center gap-4">
        <Show
          when={!isMedley() && songs()[0]}
          fallback={
            <Show when={isMedley()}>
              <SongHero
                title="Medley"
                subtitle={
                  songs().length === 1
                    ? t("sing.songCount.one", { count: 1 })
                    : t("sing.songCount.other", { count: songs().length })
                }
                covers={songs().map((song) => song.coverUrl ?? "")}
              />
            </Show>
          }
        >
          {(song) => (
            <SongHero title={song().title} subtitle={song().artist} covers={[song().coverUrl ?? ""]}>
              <Show when={isDuet(song())}>
                <div class="flex items-center gap-2 text-sm">
                  <TagChip label={getVoiceName(song(), 0)} />
                  <span class="font-black opacity-60">VS</span>
                  <TagChip label={getVoiceName(song(), 1)} />
                </div>
              </Show>
            </SongHero>
          )}
        </Show>

        <Menu
          class="h-auto w-full grow-0"
          gradient="gradient-sing"
          layer={0}
          onBack={onBack}
          items={[
            {
              type: "custom",
              interactive: true,
              render: (ctx) => (
                <PlayerSlotsRow
                  selected={ctx.selected()}
                  song={!isMedley() ? songs()[0] : null}
                  playerSlotLoop={playerSlotLoop}
                  getSlotSelection={getSlotSelection}
                  setSlotSelection={setSlotSelection}
                />
              ),
            },
            select({
              label: t("sing.length.label"),
              value: () => selectedLength(),
              options: LENGTH_OPTIONS,
              onChange: (value) => setSelectedLength(value as RoundLength),
              renderValue: (value) => <span>{value !== null ? getLengthLabel(value as RoundLength) : ""}</span>,
            }),
            {
              type: "button",
              label: t("select.start"),
              action: startGame,
            },
          ]}
        />
      </div>
    </Layout>
  );
}

interface SongHeroProps {
  title: string;
  subtitle: string;
  /** One cover, or several fanned out for a medley. */
  covers: string[];
  children?: JSX.Element;
}

function SongHero(props: SongHeroProps) {
  return (
    <div class="flex max-w-280 items-center justify-center gap-10 px-12">
      <div
        class="relative h-[17cqh] shrink-0"
        style={{ width: `calc(17cqh + ${Math.min(props.covers.length - 1, 2) * 3}cqh)` }}
      >
        <For each={props.covers.slice(0, 3).toReversed()}>
          {(cover, index) => (
            <img
              class="absolute top-0 aspect-square h-full rounded-[1.4cqw] object-cover shadow-[0_1cqw_3cqw_rgb(0_0_0/0.35)] ring-1 ring-white/15"
              style={{
                left: `${(Math.min(props.covers.length, 3) - 1 - index()) * 3}cqh`,
                transform: `rotate(${-4 + index() * 4}deg)`,
              }}
              src={cover}
              alt=""
            />
          )}
        </For>
      </div>
      <div class="flex min-w-0 flex-col gap-3">
        <span class="text-xl font-bold text-white/80">{props.subtitle}</span>
        <span class="line-clamp-2 pb-[0.1em] text-5xl leading-tight font-black tracking-tight">{props.title}</span>
        {props.children}
      </div>
    </div>
  );
}

interface PlayerSlotsRowProps {
  selected: boolean;
  song: Song | null | undefined;
  playerSlotLoop: ReturnType<typeof createLoop>;
  getSlotSelection: (index: number) => Selection | null;
  setSlotSelection: (index: number, selection: Selection | null) => void;
}

function PlayerSlotsRow(props: PlayerSlotsRowProps) {
  useNavigation(() => ({
    layer: 0,
    enabled: props.selected,
    onKeydown(event) {
      if (event.action === "left") {
        props.playerSlotLoop.decrement();
      } else if (event.action === "right") {
        props.playerSlotLoop.increment();
      }
    },
  }));

  return (
    <div class="flex items-center justify-center gap-6 py-4">
      <For each={settingsStore.microphones()}>
        {(microphone, index) => (
          <PlayerSlot
            number={index() + 1}
            microphone={microphone}
            song={props.song}
            selection={props.getSlotSelection(index())}
            onSelect={(selection) => props.setSlotSelection(index(), selection)}
            selected={props.selected && props.playerSlotLoop.position() === index()}
            onMouseEnter={() => props.playerSlotLoop.set(index())}
          />
        )}
      </For>
    </div>
  );
}

interface PlayerSlotProps {
  number: number;
  microphone: Microphone;
  song: Song | null | undefined;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  selected?: boolean;
  onMouseEnter?: () => void;
}

function PlayerSlot(props: PlayerSlotProps) {
  const [pressed, setPressed] = createSignal(false);

  const openSelectPlayerPopup = async () => {
    const result = await popup.show<Selection | null>({
      render: (resolve) => (
        <SelectPlayerPopup
          selection={props.selection}
          onClose={() => resolve(props.selection)}
          onSelect={(selection) => resolve(selection)}
          onRemove={() => resolve(null)}
          song={props.song ?? null}
        />
      ),
    });

    props.onSelect(result);
  };

  useNavigation(() => ({
    enabled: props.selected,
    onKeydown(event) {
      if (event.action === "confirm") {
        setPressed(true);
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        openSelectPlayerPopup();
      }
    },
  }));

  const color = (shade: 400 | 500 | 700 | 800) => getColorVar(props.microphone.color, shade);

  return (
    <button
      type="button"
      onClick={openSelectPlayerPopup}
      onMouseEnter={() => props.onMouseEnter?.()}
      class="relative flex h-[27cqh] w-48 cursor-pointer flex-col items-center overflow-hidden rounded-[1.4cqw] p-5 transition-all duration-200 ease-out"
      classList={{
        "-translate-y-2 outline-[0.22cqw] outline-white": props.selected && !pressed(),
        "scale-95 outline-[0.22cqw] outline-white": props.selected && pressed(),
        "focus-glow": props.selected && !!props.selection,
        "opacity-70 saturate-75": !props.selected,
        "border-[0.2cqw] border-dashed": !props.selection,
      }}
      style={{
        background: props.selection
          ? `linear-gradient(180deg, ${color(400)}, ${color(700)})`
          : `linear-gradient(180deg, color-mix(in oklch, ${color(500)} 25%, transparent), color-mix(in oklch, ${color(800)} 35%, transparent))`,
        "border-color": props.selection ? undefined : color(400),
        "--mode-glow": color(500),
      }}
    >
      <Show when={props.selected && props.selection && effectsEnabled()}>
        <div class="absolute inset-0 animate-stripes-move bg-stripes opacity-10" style={{ "--fx-color": "white" }} />
      </Show>
      <TagChip
        class="relative self-start text-xs"
        label={t("select.micLabel", { number: props.number })}
        accent={<span class="block h-2 w-2 rounded-full bg-white" />}
        accentColor={color(500)}
      />
      <div class="relative flex grow items-center justify-center">
        <Show
          when={props.selection}
          fallback={
            <div
              class="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
              style={{ "background-color": `color-mix(in oklch, ${color(400)} 30%, transparent)`, color: color(400) }}
            >
              <IconPlus />
            </div>
          }
        >
          {(selection) => (
            <Avatar
              user={selection().player}
              class="h-20 w-20 text-3xl shadow-[0_0.6cqw_1.6cqw_rgb(0_0_0/0.3)]"
              fallbackClass="bg-white/20"
            />
          )}
        </Show>
      </div>
      <div class="relative flex w-full flex-col items-center gap-1">
        <Show
          when={props.selection}
          fallback={<span class="text-sm font-bold opacity-80">{t("select.addPlayer")}</span>}
        >
          {(selection) => (
            <>
              <span class="max-w-full truncate text-2xl font-bold">{selection().player.username}</span>
              <Show when={isDuet(props.song)}>
                <TagChip class="text-xs" label={getVoiceName(props.song ?? null, selection().voice)} />
              </Show>
            </>
          )}
        </Show>
      </div>
    </button>
  );
}

interface SelectPlayerPopupProps {
  selection: Selection | null;
  onClose: () => void;
  onSelect: (selection: Selection) => void;
  onRemove: () => void;
  song: Song | null;
}

function SelectPlayerPopup(props: SelectPlayerPopupProps) {
  const [selectedVoice, setSelectedVoice] = createSignal(0);

  createEffect(() => {
    setSelectedVoice(props.selection?.voice ?? 0);
  });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  const handlePlayerSelect = (player: User) => {
    props.onSelect({ player, voice: selectedVoice() });
  };

  const handleBack = () => {
    if (props.selection) {
      props.onSelect({ ...props.selection, voice: selectedVoice() });
    } else {
      props.onClose();
    }
  };

  const users = createMemo(() => {
    const guestUser: GuestUser = {
      id: "guest",
      username: t("common.players.guest"),
      type: "guest",
    };
    return [guestUser, ...lobbyStore.localPlayersInLobby(), ...(lobbyQuery.data?.users || [])];
  });

  const playerMenuItems = createMemo((): MenuItem[] => {
    const items: MenuItem[] = [];

    if (isDuet(props.song)) {
      items.push(
        select({
          label: t("sing.voice"),
          value: () => selectedVoice(),
          onChange: (voice: number) => setSelectedVoice(voice),
          options: props.song?.voices.map((_, index) => index) ?? [],
          renderValue: (voice: number | null) => <span>{voice !== null ? getVoiceName(props.song, voice) : "?"}</span>,
        }),
      );
    }

    for (const player of users()) {
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-4">
            <Avatar user={player} />
            {player.username}
          </div>
        ),
        action: () => handlePlayerSelect(player),
      });
    }

    // Add remove button if there's a current selection
    if (props.selection) {
      items.push({
        type: "button",
        label: t("settings.remove"),
        action: () => props.onRemove(),
      });
    }

    return items;
  });

  return (
    <Layout
      intent="popup"
      header={<TitleBar title={t("select.selectPlayer")} onBack={handleBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={playerMenuItems()} onBack={handleBack} gradient="gradient-sing" layer={1} />
    </Layout>
  );
}
