import type { NavAction } from "@tuneperfect/webrtc/contracts/game";
import { type Component, createMemo, For, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconArrowFatLeft from "~icons/ph/arrow-fat-left-fill";
import IconArrowLeft from "~icons/ph/arrow-left-bold";
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
const EXTRAS: { action: NavAction; icon: Icon; label: () => string; group?: "medley" }[] = [
  { action: "search", icon: IconMagnifyingGlass, label: () => t("remote.pad.search") },
  { action: "filter", icon: IconSliders, label: () => t("remote.pad.filter") },
  { action: "menu", icon: IconList, label: () => t("remote.pad.menu") },
  { action: "random", icon: IconDice, label: () => t("remote.pad.random") },
  { action: "sort-left", icon: IconCaretLeftFill, label: () => t("remote.pad.sort") },
  { action: "sort-right", icon: IconCaretRightFill, label: () => t("remote.pad.sort") },
  { action: "filter-left", icon: IconCaretLeftFill, label: () => t("remote.pad.searchIn") },
  { action: "filter-right", icon: IconCaretRightFill, label: () => t("remote.pad.searchIn") },
  { action: "add-to-medley", icon: IconPlus, label: () => t("remote.pad.addToMedley"), group: "medley" },
  { action: "remove-from-medley", icon: IconX, label: () => t("remote.pad.removeFromMedley"), group: "medley" },
  { action: "medley-up", icon: IconCaretUpFill, label: () => t("remote.pad.medleyUp"), group: "medley" },
  { action: "medley-down", icon: IconCaretDownFill, label: () => t("remote.pad.medleyDown"), group: "medley" },
  { action: "start-random-medley", icon: IconShuffle, label: () => t("remote.pad.randomMedley"), group: "medley" },
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
export default function NavPad(props: {
  /** Actions offered elsewhere on the page (e.g. the song strip). */ hidden?: ReadonlySet<NavAction>;
}) {
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

  const shows = (action: NavAction) => shown().actions.has(action) && !props.hidden?.has(action);
  const has = (action: NavAction) => enabled().has(action);
  /**
   * Holds the game's button while the finger is on it (lists keep scrolling, like a held key).
   * Keyboard activation (Enter/Space on the focused button) is a tap.
   */
  const hold = (action: NavAction) => {
    let held = false;
    const release = () => {
      if (!held) return;
      held = false;
      remote.act({ type: "nav", action, state: "up" });
    };
    return {
      onPointerDown: (event: PointerEvent & { currentTarget: HTMLButtonElement }) => {
        if (event.button !== 0 || !has(action)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        held = true;
        remote.act({ type: "nav", action, state: "down" });
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onClick: (event: MouseEvent) => {
        if (event.detail === 0) remote.act({ type: "nav", action });
      },
      // A long press would otherwise select text or open the context menu.
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
    };
  };

  const hasPad = () => (["up", "down", "left", "right", "confirm"] as const).some(shows);
  const extras = () => EXTRAS.filter((extra) => shows(extra.action));

  const extraButton = (extra: (typeof EXTRAS)[number], classes = "") => (
    <button
      type="button"
      class={`flex h-12 cursor-pointer touch-none items-center justify-center gap-1.5 rounded-[12px] bg-white/8 px-3 text-[15px] font-bold transition-[scale,background-color,opacity] select-none [-webkit-touch-callout:none] hover:bg-white/12 active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100 ${classes}`}
      disabled={!has(extra.action)}
      {...hold(extra.action)}
    >
      <Dynamic component={extra.icon} class="shrink-0" />
      <span class="truncate">{extra.label()}</span>
    </button>
  );

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
            <Arrow action="up" icon={IconCaretUp} label={t("remote.pad.up")} enabled={has("up")} hold={hold} />
            <span />
            <Arrow action="left" icon={IconCaretLeft} label={t("remote.pad.left")} enabled={has("left")} hold={hold} />
            <button
              type="button"
              class="gradient-accent flex size-20 cursor-pointer touch-none items-center justify-center rounded-full text-lg font-black shadow-crisp transition-[scale,opacity] select-none [-webkit-touch-callout:none] active:scale-95 disabled:cursor-default disabled:opacity-25"
              disabled={!has("confirm")}
              {...hold("confirm")}
            >
              {t("remote.pad.confirm")}
            </button>
            <Arrow
              action="right"
              icon={IconCaretRight}
              label={t("remote.pad.right")}
              enabled={has("right")}
              hold={hold}
            />
            <span />
            <Arrow action="down" icon={IconCaretDown} label={t("remote.pad.down")} enabled={has("down")} hold={hold} />
            <span />
          </div>
        </Show>

        <div class="grid w-full grid-cols-2 gap-2">
          <Show when={shows("back")}>
            <button
              type="button"
              class="col-span-2 flex h-12 cursor-pointer touch-none items-center justify-center gap-1.5 rounded-[12px] bg-white/10 px-3 text-[15px] font-bold transition-[scale,background-color,opacity] select-none [-webkit-touch-callout:none] hover:bg-white/15 active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100"
              disabled={!has("back")}
              {...hold("back")}
            >
              <IconArrowLeft />
              {t("remote.pad.back")}
            </button>
          </Show>
          <For each={extras().filter((extra) => !extra.group)}>{(extra) => extraButton(extra)}</For>
        </div>

        {/* Under their own heading, so the buttons only need a short label. */}
        <Show when={extras().some((extra) => extra.group === "medley")}>
          <section class="flex w-full flex-col gap-2">
            <h3 class="text-xs font-bold tracking-[0.12em] text-white/50 uppercase">{t("remote.pad.medley")}</h3>
            <div class="grid grid-cols-2 gap-2">
              <For each={extras().filter((extra) => extra.group === "medley")}>{(extra) => extraButton(extra)}</For>
            </div>
          </section>
        </Show>
      </div>
    </Show>
  );
}

function Arrow(props: {
  action: NavAction;
  icon: Icon;
  label: string;
  enabled: boolean;
  hold: (action: NavAction) => JSX.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      class="flex size-20 cursor-pointer touch-none items-center justify-center rounded-[16px] bg-white/10 text-3xl transition-[scale,background-color,opacity] select-none [-webkit-touch-callout:none] hover:bg-white/15 active:scale-95 disabled:cursor-default disabled:opacity-25"
      disabled={!props.enabled}
      {...props.hold(props.action)}
    >
      <Dynamic component={props.icon} />
    </button>
  );
}
