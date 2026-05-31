import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import IconPlus from "~icons/lucide/plus";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
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

export const Route = createFileRoute("/sing/select")({
  component: PlayerSelectionComponent,
});

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

function PlayerSelectionComponent() {
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
      <div class="flex h-full flex-col items-center justify-center gap-8">
        <Show
          when={!isMedley() && songs()[0]}
          fallback={
            <Show when={isMedley()}>
              <div class="flex flex-col items-center gap-3 text-center">
                <span class="gradient-sing max-w-4xl bg-linear-to-r bg-clip-text text-center text-5xl font-bold text-transparent">
                  Medley
                </span>
                <p class="text-2xl opacity-80">
                  {songs().length === 1
                    ? t("sing.songCount.one", { count: 1 })
                    : t("sing.songCount.other", { count: songs().length })}
                </p>
              </div>
            </Show>
          }
        >
          {(song) => (
            <div class="flex flex-col items-center gap-3 text-center">
              <p class="text-2xl opacity-80">{song().artist}</p>
              <span class="gradient-sing max-w-4xl bg-linear-to-r bg-clip-text text-center text-5xl font-bold text-transparent">
                {song().title}
              </span>
              <Show when={isDuet(song())}>
                <div class="mt-2 flex items-center gap-1 text-sm">
                  <span class="rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">{getVoiceName(song(), 0)}</span>
                  <span class="opacity-50">&</span>
                  <span class="rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">{getVoiceName(song(), 1)}</span>
                </div>
              </Show>
            </div>
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
            {
              type: "select-string",
              label: t("sing.length.label"),
              value: () => selectedLength(),
              options: LENGTH_OPTIONS,
              onChange: (value) => setSelectedLength(value as RoundLength),
              renderValue: (value) => <span>{value !== null ? getLengthLabel(value as RoundLength) : ""}</span>,
            },
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

  return (
    <button
      type="button"
      onClick={openSelectPlayerPopup}
      onMouseEnter={() => props.onMouseEnter?.()}
      class="flex w-56 cursor-pointer flex-col overflow-hidden rounded-xl shadow-lg transition-all duration-200 ease-in-out active:scale-95"
      classList={{
        "scale-105 ring-4 ring-white": props.selected,
        "opacity-50": !props.selected,
        "scale-95!": pressed(),
      }}
      style={{
        background: `linear-gradient(180deg, ${getColorVar(props.microphone.color, 500)} 0%, ${getColorVar(props.microphone.color, 700)} 100%)`,
      }}
    >
      {/* Main content area */}
      <div class="flex w-full grow flex-col items-center justify-center gap-4 p-6">
        <Show
          when={props.selection}
          fallback={
            <>
              <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 transition-colors">
                <IconPlus class="text-3xl opacity-70" />
              </div>
              <span class="text-center text-sm opacity-70">{t("select.addPlayer")}</span>
            </>
          }
        >
          {(selection) => <Avatar user={selection().player} class="h-20 w-20 text-2xl" fallbackClass="bg-white/20" />}
        </Show>
      </div>

      {/* Footer name area */}
      <Show when={props.selection}>
        {(selection) => (
          <div class="flex w-full flex-col items-center gap-0.5 bg-black/20 px-4 py-3">
            <span class="max-w-full truncate text-center text-sm font-semibold">{selection().player.username}</span>
            <Show when={isDuet(props.song)}>
              <span class="text-center text-xs opacity-60">{getVoiceName(props.song ?? null, selection().voice)}</span>
            </Show>
          </div>
        )}
      </Show>
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
      items.push({
        type: "select-number",
        label: t("sing.voice"),
        value: () => selectedVoice(),
        onChange: (voice: number) => setSelectedVoice(voice),
        options: props.song?.voices.map((_, index) => index) ?? [],
        renderValue: (voice: number | null) => <span>{voice !== null ? getVoiceName(props.song, voice) : "?"}</span>,
      });
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
