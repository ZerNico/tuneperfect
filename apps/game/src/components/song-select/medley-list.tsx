import { createEffect, For, on, Show } from "solid-js";
import { TransitionGroup } from "solid-transition-group";
import IconTriangleDown from "~icons/ph/caret-down-fill";
import IconTriangleUp from "~icons/ph/caret-up-fill";
import IconX from "~icons/ph/x-bold";
import IconDownArrowKey from "~icons/sing/down-arrow-key";
import IconF2Key from "~icons/sing/f2-key";
import IconGamepadDPad from "~icons/sing/gamepad-dpad";
import IconGamepadLT from "~icons/sing/gamepad-lt";
import IconGamepadRStick from "~icons/sing/gamepad-rstick";
import IconPageDownKey from "~icons/sing/page-down-key";
import IconPageUpKey from "~icons/sing/page-up-key";
import IconUpArrowKey from "~icons/sing/up-arrow-key";

import { createListNavigation } from "~/hooks/list-navigation";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import type { LocalSong } from "~/lib/ultrastar/song";

import KeyGlyph from "../ui/key-glyph";

interface MedleyListProps {
  songs: LocalSong[];
  onRemove: (index: number) => void;
  /** The selected entry, for removing it by key (the screen owns that key, so it's there with an empty medley too). */
  onSelectedChange?: (index: number) => void;
  onStart?: () => void;
  useAlternativeNavigation?: boolean;
}

export function MedleyList(props: MedleyListProps) {
  const list = createListNavigation({
    get count() {
      return props.songs.length;
    },
    get keys() {
      return props.useAlternativeNavigation ? (["medley-up", "medley-down"] as const) : (["up", "down"] as const);
    },
    sound: false,
  });
  createEffect(() => props.onSelectedChange?.(list.position()));

  // Select a newly added song; keep the selection on the list when songs are removed.
  createEffect(
    on(
      () => props.songs.length,
      (newLength, oldLength) => {
        if (oldLength === undefined || newLength === oldLength) return;
        if (newLength > oldLength) list.set(newLength - 1);
        list.scrollToSelected();
      },
    ),
  );

  // Rows fade in when added and fade out when removed, instead of popping.
  const ROW_MS = 200;
  const fadeRow = (el: Element, done: () => void, keyframes: Keyframe[]) => {
    if (!effectsEnabled()) return done();
    el.animate(keyframes, { duration: ROW_MS, easing: "ease-out" }).finished.then(done);
  };
  const enterRow = (el: Element, done: () => void) => fadeRow(el, done, [{ opacity: 0 }, { opacity: 1 }]);
  const exitRow = (el: Element, done: () => void) => fadeRow(el, done, [{ opacity: 1 }, { opacity: 0 }]);

  const UpKeyIcon = () => (
    <Show
      when={props.useAlternativeNavigation}
      fallback={<KeyGlyph keyboard={IconUpArrowKey} gamepad={IconGamepadDPad} class="text-sm" />}
    >
      <KeyGlyph keyboard={IconPageUpKey} gamepad={IconGamepadRStick} class="text-sm" />
    </Show>
  );

  const DownKeyIcon = () => (
    <Show
      when={props.useAlternativeNavigation}
      fallback={<KeyGlyph keyboard={IconDownArrowKey} gamepad={IconGamepadDPad} class="text-sm" />}
    >
      <KeyGlyph keyboard={IconPageDownKey} gamepad={IconGamepadRStick} class="text-sm" />
    </Show>
  );

  return (
    <div class="h-full w-[24cqw]">
      <div class="flex h-full flex-col gap-3 rounded-[1.4cqw] glass p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-3">
            <span class="text-2xl font-bold">{t("sing.medley.title")}</span>
            <span class="shrink-0 text-sm font-bold text-white/60">
              {props.songs.length === 1
                ? t("sing.songCount.one", { count: 1 })
                : t("sing.songCount.other", { count: props.songs.length })}
            </span>
          </div>
          <button
            type="button"
            class="flex shrink-0 cursor-pointer items-center gap-1.5 transition-[opacity,scale] hover:opacity-75 active:scale-95"
            onClick={() => list.move(-1)}
          >
            <UpKeyIcon />
            <IconTriangleUp class="text-lg" />
          </button>
        </div>

        <div class="relative min-h-0 flex-1">
          <div class="styled-scrollbars absolute flex h-full w-full flex-col gap-2 overflow-x-hidden overflow-y-auto px-1 py-1">
            <TransitionGroup onEnter={enterRow} onExit={exitRow}>
              <For each={props.songs}>
                {(song, index) => {
                  const isSelected = () => list.isSelected(index());
                  return (
                    <div ref={list.itemRef(index)} class="shrink-0">
                      <div
                        class="group flex h-[3.6cqw] items-center gap-3 rounded-[0.8cqw] pr-2 pl-3 transition-[background] duration-200"
                        classList={{
                          "bg-white/8 ring-1 ring-white/10 ring-inset": !isSelected(),
                          "gradient-sing bg-linear-to-r": isSelected(),
                        }}
                        onClick={() => list.set(index())}
                      >
                        <span class="w-5 shrink-0 text-center text-lg font-black tabular-nums">{index() + 1}</span>
                        <div class="size-[2.6cqw] shrink-0 overflow-hidden rounded-md bg-black/40">
                          <Show when={song.coverUrl}>
                            {(url) => <img src={url()} alt="" class="size-full object-cover" draggable={false} />}
                          </Show>
                        </div>
                        <div class="min-w-0 grow">
                          <div class="truncate text-sm font-bold">{song.title}</div>
                          <div class="truncate text-xs text-white/70">{song.artist}</div>
                        </div>
                        <div
                          class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          classList={{ "opacity-100": isSelected() }}
                        >
                          <Show when={isSelected()}>
                            <KeyGlyph keyboard={IconF2Key} gamepad={IconGamepadLT} class="text-xs" />
                          </Show>
                          <button
                            type="button"
                            aria-label={t("common.remove")}
                            class="flex size-6 cursor-pointer items-center justify-center rounded-md bg-black/40 transition-[background-color,scale] hover:bg-black/60 active:scale-95"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onRemove(index());
                            }}
                          >
                            <IconX class="text-sm" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </TransitionGroup>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <Show when={props.onStart}>
            <button
              type="button"
              class="gradient-sing flex h-10 grow cursor-pointer items-center justify-center rounded-[0.8cqw] bg-linear-to-r px-4 text-sm font-bold focus-glow transition-[scale] active:scale-95"
              onClick={() => props.onStart?.()}
            >
              {t("sing.menu.startMedley")}
            </button>
          </Show>
          <button
            type="button"
            class="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 transition-[opacity,scale] hover:opacity-75 active:scale-95"
            onClick={() => list.move(1)}
          >
            <DownKeyIcon />
            <IconTriangleDown class="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
