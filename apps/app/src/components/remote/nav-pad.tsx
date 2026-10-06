import type { NavAction } from "@tuneperfect/webrtc/contracts/game";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconCaretDown from "~icons/ph/caret-down-bold";
import IconCaretLeft from "~icons/ph/caret-left-bold";
import IconCaretRight from "~icons/ph/caret-right-bold";
import IconCaretUp from "~icons/ph/caret-up-bold";
import IconDice from "~icons/ph/dice-five-bold";
import IconList from "~icons/ph/list-bold";
import IconMagnifyingGlass from "~icons/ph/magnifying-glass-bold";
import IconShuffle from "~icons/ph/shuffle-bold";
import IconSkipForward from "~icons/ph/skip-forward-bold";

import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

/** The game's own buttons, for players with full control: works on every screen of the game. */
export default function NavPad() {
  const remote = useRemote();
  const press = (action: NavAction) => remote.act({ type: "nav", action });

  return (
    <div class="flex flex-col items-center gap-5">
      <div class="grid grid-cols-3 gap-2">
        <span />
        <PadButton icon={IconCaretUp} label={t("remote.pad.up")} onPress={() => press("up")} />
        <span />
        <PadButton icon={IconCaretLeft} label={t("remote.pad.left")} onPress={() => press("left")} />
        <button
          type="button"
          class="gradient-accent flex size-20 cursor-pointer items-center justify-center rounded-full text-lg font-black shadow-crisp transition-transform select-none active:scale-95"
          onClick={() => press("confirm")}
        >
          {t("remote.pad.confirm")}
        </button>
        <PadButton icon={IconCaretRight} label={t("remote.pad.right")} onPress={() => press("right")} />
        <span />
        <PadButton icon={IconCaretDown} label={t("remote.pad.down")} onPress={() => press("down")} />
        <span />
      </div>

      <div class="grid w-full grid-cols-2 gap-2">
        <TextButton onPress={() => press("back")}>{t("remote.pad.back")}</TextButton>
        <TextButton onPress={() => press("menu")}>
          <IconList />
          {t("remote.pad.menu")}
        </TextButton>
      </div>
      <div class="grid w-full grid-cols-3 gap-2">
        <TextButton onPress={() => press("search")}>
          <IconMagnifyingGlass />
          {t("remote.pad.search")}
        </TextButton>
        <TextButton onPress={() => press("random")}>
          <IconShuffle />
          {t("remote.pad.random")}
        </TextButton>
        <TextButton onPress={() => press("skip")}>
          <IconSkipForward />
          {t("remote.pad.skip")}
        </TextButton>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <TextButton onPress={() => press("joker-1")}>
          <IconDice />
          {t("remote.pad.joker", { number: 1 })}
        </TextButton>
        <TextButton onPress={() => press("joker-2")}>
          <IconDice />
          {t("remote.pad.joker", { number: 2 })}
        </TextButton>
      </div>
    </div>
  );
}

function PadButton(props: { icon: Component<{ class?: string }>; label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      class="flex size-20 cursor-pointer items-center justify-center rounded-[16px] bg-white/10 text-3xl transition-[scale,background-color] select-none hover:bg-white/15 active:scale-95"
      onClick={() => props.onPress()}
    >
      <Dynamic component={props.icon} />
    </button>
  );
}

function TextButton(props: { children: JSX.Element; onPress: () => void }) {
  return (
    <button
      type="button"
      class="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-white/8 px-3 text-[15px] font-bold transition-[scale,background-color] select-none hover:bg-white/12 active:scale-[0.97]"
      onClick={() => props.onPress()}
    >
      {props.children}
    </button>
  );
}
