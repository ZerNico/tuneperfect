import type { NavAction } from "@tuneperfect/webrtc/contracts/game";
import { type Component, createMemo, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconArrowFatLeft from "~icons/ph/arrow-fat-left-fill";
import IconCaretDown from "~icons/ph/caret-down-bold";
import IconCaretDownFill from "~icons/ph/caret-down-fill";
import IconCaretLeft from "~icons/ph/caret-left-bold";
import IconCaretLeftFill from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-bold";
import IconCaretRightFill from "~icons/ph/caret-right-fill";
import IconCaretUp from "~icons/ph/caret-up-bold";
import IconCaretUpFill from "~icons/ph/caret-up-fill";
import IconDice from "~icons/ph/dice-five-fill";
import IconList from "~icons/ph/list-bold";
import IconMagnifyingGlass from "~icons/ph/magnifying-glass-bold";
import IconMicrophoneSlash from "~icons/ph/microphone-slash-bold";
import IconMinus from "~icons/ph/minus-bold";
import IconPlus from "~icons/ph/plus-bold";
import IconShuffle from "~icons/ph/shuffle-bold";
import IconSkipForward from "~icons/ph/skip-forward-bold";
import IconSliders from "~icons/ph/sliders-horizontal-bold";
import IconX from "~icons/ph/x-bold";

import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

type Icon = Component<{ class?: string }>;

/** The game's other buttons, in the order they're offered, with the game's icons. Ones this app doesn't know are left out. */
const EXTRAS: { action: NavAction; icon: Icon; label: () => string }[] = [
  { action: "search", icon: IconMagnifyingGlass, label: () => t("remote.pad.search") },
  { action: "filter", icon: IconSliders, label: () => t("remote.pad.filter") },
  { action: "menu", icon: IconList, label: () => t("remote.pad.menu") },
  { action: "random", icon: IconDice, label: () => t("remote.pad.random") },
  { action: "sort-left", icon: IconCaretLeftFill, label: () => t("remote.pad.sort") },
  { action: "sort-right", icon: IconCaretRightFill, label: () => t("remote.pad.sort") },
  { action: "filter-left", icon: IconCaretLeftFill, label: () => t("remote.pad.searchIn") },
  { action: "filter-right", icon: IconCaretRightFill, label: () => t("remote.pad.searchIn") },
  { action: "add-to-medley", icon: IconPlus, label: () => t("remote.pad.addToMedley") },
  { action: "remove-from-medley", icon: IconX, label: () => t("remote.pad.removeFromMedley") },
  { action: "medley-up", icon: IconCaretUpFill, label: () => t("remote.pad.medleyUp") },
  { action: "medley-down", icon: IconCaretDownFill, label: () => t("remote.pad.medleyDown") },
  { action: "start-random-medley", icon: IconShuffle, label: () => t("remote.pad.randomMedley") },
  { action: "zoom-out", icon: IconMinus, label: () => t("remote.pad.zoomOut") },
  { action: "zoom-in", icon: IconPlus, label: () => t("remote.pad.zoomIn") },
  { action: "joker-1", icon: IconDice, label: () => t("remote.pad.joker", { number: 1 }) },
  { action: "joker-2", icon: IconDice, label: () => t("remote.pad.joker", { number: 2 }) },
  { action: "skip", icon: IconSkipForward, label: () => t("remote.pad.skip") },
  { action: "instrumental", icon: IconMicrophoneSlash, label: () => t("remote.pad.instrumental") },
  { action: "clear", icon: IconArrowFatLeft, label: () => t("remote.pad.clear") },
];

/**
 * The game's own buttons, for players with full control: the ones the game's current screen
 * offers. A button stays in place while the game is on that screen, disabled while it does
 * nothing (e.g. a popup is open), so the others don't move around.
 */
export default function NavPad() {
  const remote = useRemote();

  /** Every action seen on the game's current screen; starts over on another screen. */
  const shown = createMemo<{ screen: string; actions: Set<NavAction> }>((previous) => {
    const state = remote.state();
    const screen = state?.screen ?? "";
    const actions = new Set(previous?.screen === screen ? previous.actions : []);
    for (const { action } of state?.actions ?? []) actions.add(action);
    return { screen, actions };
  });
  const enabled = createMemo(
    () => new Set((remote.state()?.actions ?? []).filter((entry) => entry.enabled).map((entry) => entry.action)),
  );

  const shows = (action: NavAction) => shown().actions.has(action);
  const has = (action: NavAction) => enabled().has(action);
  const press = (action: NavAction) => remote.act({ type: "nav", action });

  const hasPad = () => (["up", "down", "left", "right", "confirm"] as const).some(shows);
  const extras = () => EXTRAS.filter((extra) => shows(extra.action));

  return (
    <Show
      when={hasPad() || shows("back") || extras().length > 0}
      fallback={<p class="text-center text-white/50">{t("remote.pad.nothing")}</p>}
    >
      <div class="flex flex-col items-center gap-5">
        <Show when={hasPad()}>
          {/* Missing directions keep their place, so the pad doesn't jump around between screens. */}
          <div class="grid grid-cols-3 gap-2">
            <span />
            <Arrow action="up" icon={IconCaretUp} label={t("remote.pad.up")} enabled={has("up")} onPress={press} />
            <span />
            <Arrow
              action="left"
              icon={IconCaretLeft}
              label={t("remote.pad.left")}
              enabled={has("left")}
              onPress={press}
            />
            <button
              type="button"
              class="gradient-accent flex size-20 cursor-pointer items-center justify-center rounded-full text-lg font-black shadow-crisp transition-[scale,opacity] select-none active:scale-95 disabled:cursor-default disabled:opacity-25"
              disabled={!has("confirm")}
              onClick={() => press("confirm")}
            >
              {t("remote.pad.confirm")}
            </button>
            <Arrow
              action="right"
              icon={IconCaretRight}
              label={t("remote.pad.right")}
              enabled={has("right")}
              onPress={press}
            />
            <span />
            <Arrow
              action="down"
              icon={IconCaretDown}
              label={t("remote.pad.down")}
              enabled={has("down")}
              onPress={press}
            />
            <span />
          </div>
        </Show>

        <div class="grid w-full grid-cols-2 gap-2">
          <Show when={shows("back")}>
            <button
              type="button"
              class="col-span-2 flex h-12 cursor-pointer items-center justify-center rounded-[12px] bg-white/10 px-3 text-[15px] font-bold transition-[scale,background-color,opacity] select-none hover:bg-white/15 active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100"
              disabled={!has("back")}
              onClick={() => press("back")}
            >
              {t("remote.pad.back")}
            </button>
          </Show>
          <For each={extras()}>
            {(extra) => (
              <button
                type="button"
                class="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-white/8 px-3 text-[15px] font-bold transition-[scale,background-color,opacity] select-none hover:bg-white/12 active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100"
                disabled={!has(extra.action)}
                onClick={() => press(extra.action)}
              >
                <Dynamic component={extra.icon} class="shrink-0" />
                <span class="truncate">{extra.label()}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

function Arrow(props: {
  action: NavAction;
  icon: Icon;
  label: string;
  enabled: boolean;
  onPress: (action: NavAction) => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      class="flex size-20 cursor-pointer items-center justify-center rounded-[16px] bg-white/10 text-3xl transition-[scale,background-color,opacity] select-none hover:bg-white/15 active:scale-95 disabled:cursor-default disabled:opacity-25"
      disabled={!props.enabled}
      onClick={() => props.onPress(props.action)}
    >
      <Dynamic component={props.icon} />
    </button>
  );
}
