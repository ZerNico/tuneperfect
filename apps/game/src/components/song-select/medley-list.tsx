import { createEffect, For, on, Show } from "solid-js";
import { TransitionGroup } from "solid-transition-group";
import IconTriangleDown from "~icons/ph/caret-down-fill";
import IconTriangleUp from "~icons/ph/caret-up-fill";
import IconX from "~icons/ph/x-bold";
import IconDownArrowKey from "~icons/sing/down-arrow-key";
import IconF2Key from "~icons/sing/f2-key";
import IconGamepadLT from "~icons/sing/gamepad-lt";
import IconGamepadRStick from "~icons/sing/gamepad-rstick";
import IconPageDownKey from "~icons/sing/page-down-key";
import IconPageUpKey from "~icons/sing/page-up-key";
import IconUpArrowKey from "~icons/sing/up-arrow-key";

import { createLoop } from "~/hooks/loop";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import type { LocalSong } from "~/lib/ultrastar/song";

import SlantPanel from "../ui/slant-panel";

interface MedleyListProps {
  songs: LocalSong[];
  onRemove: (index: number) => void;
  onStart?: () => void;
  useAlternativeNavigation?: boolean;
}

export function MedleyList(props: MedleyListProps) {
  const { position, increment, decrement, set } = createLoop(() => props.songs.length);
  let scrollContainer: HTMLDivElement | undefined;
  const itemRefs: (HTMLDivElement | undefined)[] = [];

  const setItemRef = (index: number) => (el: HTMLDivElement) => {
    itemRefs[index] = el;
  };

  useNavigation({
    onKeydown(event) {
      const upAction = props.useAlternativeNavigation ? "medley-up" : "up";
      const downAction = props.useAlternativeNavigation ? "medley-down" : "down";

      if (event.action === upAction) {
        decrement();
      } else if (event.action === downAction) {
        increment();
      } else if (event.action === "remove-from-medley") {
        props.onRemove(position());
      }
    },
  });

  createEffect(
    on(
      position,
      () => {
        const selectedItem = itemRefs[position()];
        if (selectedItem && scrollContainer) {
          selectedItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.songs.length,
      (newLength, oldLength) => {
        if (oldLength === undefined) return;

        if (newLength > oldLength) {
          set(newLength - 1);
        } else if (newLength < oldLength) {
          const currentPos = position();
          if (currentPos >= newLength) {
            set(Math.max(0, newLength - 1));
          }
        }
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
      when={keyMode() === "keyboard"}
      fallback={props.useAlternativeNavigation ? <IconGamepadRStick class="text-sm" /> : null}
    >
      <Show when={props.useAlternativeNavigation} fallback={<IconUpArrowKey class="text-sm" />}>
        <IconPageUpKey class="text-sm" />
      </Show>
    </Show>
  );

  const DownKeyIcon = () => (
    <Show
      when={keyMode() === "keyboard"}
      fallback={props.useAlternativeNavigation ? <IconGamepadRStick class="text-sm" /> : null}
    >
      <Show when={props.useAlternativeNavigation} fallback={<IconDownArrowKey class="text-sm" />}>
        <IconPageDownKey class="text-sm" />
      </Show>
    </Show>
  );

  return (
    <div class="h-full w-[24cqw]">
      <div class="flex h-full flex-col gap-3 rounded-2xl glass p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-3">
            <span class="text-3xl text-display">{t("sing.medley.title")}</span>
            <span class="shrink-0 text-sm font-bold text-white/60">
              {props.songs.length === 1
                ? t("sing.songCount.one", { count: 1 })
                : t("sing.songCount.other", { count: props.songs.length })}
            </span>
          </div>
          <button
            type="button"
            class="flex shrink-0 cursor-pointer items-center gap-1.5 transition-all hover:opacity-75 active:scale-95"
            onClick={() => decrement()}
          >
            <UpKeyIcon />
            <IconTriangleUp class="text-lg" />
          </button>
        </div>

        <div class="relative min-h-0 flex-1">
          <div
            ref={scrollContainer}
            class="styled-scrollbars absolute flex h-full w-full flex-col gap-2 overflow-x-hidden overflow-y-auto px-1 py-1"
          >
            <TransitionGroup onEnter={enterRow} onExit={exitRow}>
              <For each={props.songs}>
                {(song, index) => {
                  const isSelected = () => position() === index();
                  return (
                    <div ref={setItemRef(index())} class="shrink-0">
                      <SlantPanel
                        class="group flex h-[3.6cqw] items-center gap-3 pr-2 pl-3"
                        surface="rounded-lg transition-[background,box-shadow] duration-200"
                        surfaceClassList={{
                          "bg-white/8 ring-1 ring-white/10 ring-inset": !isSelected(),
                          "gradient-sing bg-linear-to-r shadow-[0.3cqw_0.3cqw_0_rgb(0_0_0/0.35)]": isSelected(),
                        }}
                        onClick={() => set(index())}
                      >
                        <span class="w-5 shrink-0 text-center text-lg text-display tabular-nums">{index() + 1}</span>
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
                            <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLT class="text-xs" />}>
                              <IconF2Key class="text-xs" />
                            </Show>
                          </Show>
                          <button
                            type="button"
                            aria-label="Remove"
                            class="flex size-6 cursor-pointer items-center justify-center rounded-md bg-black/40 transition-all hover:bg-black/60 active:scale-95"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onRemove(index());
                            }}
                          >
                            <IconX class="text-sm" />
                          </button>
                        </div>
                      </SlantPanel>
                    </div>
                  );
                }}
              </For>
            </TransitionGroup>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <Show when={props.onStart}>
            <SlantPanel
              as="button"
              type="button"
              class="flex h-10 grow cursor-pointer items-center justify-center px-4 text-sm font-bold transition-[scale] active:scale-95"
              surface="gradient-sing rounded-lg bg-linear-to-r shadow-[0.3cqw_0.3cqw_0_rgb(0_0_0/0.35)]"
              onClick={() => props.onStart?.()}
            >
              {t("sing.menu.startMedley")}
            </SlantPanel>
          </Show>
          <button
            type="button"
            class="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 transition-all hover:opacity-75 active:scale-95"
            onClick={() => increment()}
          >
            <DownKeyIcon />
            <IconTriangleDown class="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
