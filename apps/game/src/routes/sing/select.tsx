import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { popup } from "~/lib/popup";
import { lobbyQueryOptions } from "~/lib/queries";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import type { GuestUser, User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { isGuestUser } from "~/lib/utils/user";
import { lobbyStore } from "~/stores/lobby";

import { type PlayerSelection, useRoundActions } from "~/stores/round";
import { type Microphone, settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconPlus from "~icons/lucide/plus";
import IconUser from "~icons/lucide/user";

export const Route = createFileRoute("/sing/select")({
  component: PlayerSelectionComponent,
  validateSearch: v.object({
    songs: v.array(v.string()),
  }),
});

interface Selection {
  player: User;
  voice: number;
}

const [slotSelections, setSlotSelections] = createSignal<(Selection | undefined)[]>([]);

function PlayerSelectionComponent() {
  const menuLoop = createLoop(2);
  const playerSlotLoop = createLoop(settingsStore.microphones().length);
  const roundActions = useRoundActions();

  const navigate = useNavigate();

  const search = Route.useSearch();
  const songs = createMemo(() => {
    const songHashes = search().songs;
    return songHashes
      .map((hash) => songsStore.songs().find((song) => song.hash === hash))
      .filter((song): song is NonNullable<typeof song> => song !== undefined);
  });

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

  initializeSlotSelections();

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

  useNavigation(() => ({
    layer: 0,
    onKeydown(event) {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "left") {
        if (menuLoop.position() === 0) {
          playerSlotLoop.decrement();
        }
      } else if (event.action === "right") {
        if (menuLoop.position() === 0) {
          playerSlotLoop.increment();
        }
      } else if (event.action === "up") {
        menuLoop.decrement();
      } else if (event.action === "down") {
        menuLoop.increment();
      }
    },
  }));

  const hasAnyPlayer = createMemo(() => slotSelections().some((selection) => selection !== undefined));

  const startGame = () => {
    const song = songs()[0];
    if (!song) return;

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

    roundActions.startRound({ songs: [{ song, players, mode: "regular" }] });
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("select.title")} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
      background={
        <Show when={songs().length === 1 && songs()[0]} fallback={<div />}>
          {(song) => (
            <div class="h-full w-full bg-black backdrop-blur-2xl">
              <img class="h-full w-full object-cover opacity-50" src={song().coverUrl ?? ""} alt={song().title} />
              <div class="absolute inset-0 z-1 backdrop-blur-2xl" />
            </div>
          )}
        </Show>
      }
    >
      <div class="flex h-full flex-col items-center justify-center gap-12">
        <Show when={songs().length === 1 && songs()[0]}>
          {(song) => {
            const isDuet = () => song().voices.length > 1;
            const getVoiceName = (voiceIndex: number) => {
              const voiceKey = `p${voiceIndex + 1}` as "p1" | "p2";
              return song()[voiceKey] || `${t("sing.voice")} ${voiceIndex + 1}`;
            };

            return (
              <div class="flex flex-col items-center gap-3 text-center">
                <p class="text-2xl opacity-80">{song().artist}</p>
                <span class="gradient-sing max-w-4xl bg-linear-to-r bg-clip-text text-center font-bold text-5xl text-transparent">
                  {song().title}
                </span>
                <Show when={isDuet()}>
                  <div class="mt-2 flex items-center gap-1 text-sm">
                    <span class="rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">{getVoiceName(0)}</span>
                    <span class="opacity-50">&</span>
                    <span class="rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">{getVoiceName(1)}</span>
                  </div>
                </Show>
              </div>
            );
          }}
        </Show>

        <div class="flex w-full flex-col gap-4">
          <div class="flex w-full items-center justify-center gap-6">
            <For each={settingsStore.microphones()}>
              {(microphone, index) => (
                <PlayerSlot
                  microphone={microphone}
                  song={songs().length === 1 ? songs()[0] : null}
                  selection={getSlotSelection(index())}
                  onSelect={(selection) => setSlotSelection(index(), selection)}
                  selected={playerSlotLoop.position() === index() && menuLoop.position() === 0}
                  onMouseEnter={() => {
                    playerSlotLoop.set(index());
                    menuLoop.set(0);
                  }}
                />
              )}
            </For>
          </div>

          <Button
            onClick={startGame}
            gradient="gradient-sing"
            class="w-full"
            onMouseEnter={() => menuLoop.set(1)}
            selected={menuLoop.position() === 1}
          >
            {t("select.start")}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

interface PlayerSlotProps {
  microphone: Microphone;
  song: LocalSong | null | undefined;
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

  const getVoiceName = (voiceIndex: number) => {
    if (!props.song) return `${t("sing.voice")} ${voiceIndex + 1}`;
    const voiceKey = `p${voiceIndex + 1}` as "p1" | "p2";
    return props.song[voiceKey] || `${t("sing.voice")} ${voiceIndex + 1}`;
  };

  const isDuet = () => props.song && props.song.voices.length > 1;

  return (
    <button
      type="button"
      onClick={openSelectPlayerPopup}
      onMouseEnter={props.onMouseEnter}
      class="flex h-60 w-50 cursor-pointer flex-col overflow-hidden rounded-xl transition-all duration-200 ease-in-out active:scale-95"
      classList={{ "scale-105": props.selected, "opacity-50": !props.selected, "scale-95!": pressed() }}
      style={{
        background: `linear-gradient(90deg, ${getColorVar(props.microphone.color, 500)} 0%, ${getColorVar(props.microphone.color, 600)} 100%)`,
      }}
    >
      <div class="flex w-full grow flex-col items-center justify-center gap-4">
        <Show
          when={props.selection}
          fallback={
            <>
              <div class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white border-dashed font-bold text-4xl">
                <IconPlus class="text-4xl" />
              </div>
              <span class="text-center text-sm">{t("select.addPlayer")}</span>
            </>
          }
        >
          {(selection) => (
            <>
              <Show
                when={selection().player}
                fallback={
                  <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
                    <IconUser class="text-4xl" />
                  </div>
                }
              >
                <Avatar user={selection().player} class="h-20 w-20 text-2xl" />
              </Show>
              <div class="flex flex-col items-center gap-1">
                <span class="text-center font-medium text-sm">{selection().player.username}</span>
                <Show when={isDuet()}>
                  <span class="text-center text-xs opacity-70">{getVoiceName(selection().voice)}</span>
                </Show>
              </div>
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
  song: LocalSong | null;
}

function SelectPlayerPopup(props: SelectPlayerPopupProps) {
  const [selectedVoice, setSelectedVoice] = createSignal(props.selection?.voice ?? 0);

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  const isDuet = () => props.song && props.song.voices.length > 1;

  const getVoiceName = (voiceIndex: number) => {
    if (!props.song) return `${t("sing.voice")} ${voiceIndex + 1}`;
    const voiceKey = `p${voiceIndex + 1}` as "p1" | "p2";
    return props.song[voiceKey] || `${t("sing.voice")} ${voiceIndex + 1}`;
  };

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

  const playerMenuItems = createMemo((): MenuItem[] => {
    const items: MenuItem[] = [];

    const guestUser: GuestUser = {
      id: "guest",
      username: t("common.players.guest"),
      type: "guest",
    };

    const users = () => [guestUser, ...lobbyStore.localPlayersInLobby(), ...(lobbyQuery.data?.users || [])];

    if (isDuet()) {
      items.push({
        type: "select-number",
        label: t("sing.voice"),
        value: () => selectedVoice(),
        onChange: (voice: number) => setSelectedVoice(voice),
        options: props.song?.voices.map((_, index) => index) ?? [],
        renderValue: (voice: number | null) => <span>{voice !== null ? getVoiceName(voice) : "?"}</span>,
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
