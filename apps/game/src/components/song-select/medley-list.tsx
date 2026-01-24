import { createEffect, For, on, Show } from "solid-js";
import { createLoop } from "~/hooks/loop";
import { keyMode, useNavigation } from "~/hooks/navigation";
import type { LocalSong } from "~/lib/ultrastar/song";
import IconX from "~icons/lucide/x";
import IconF2Key from "~icons/sing/f2-key";
import IconGamepadLT from "~icons/sing/gamepad-lt";

interface MedleyListProps {
  songs: LocalSong[];
  onRemove: (index: number) => void;
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
      if (event.action === "up") {
        decrement();
      }
      if (event.action === "down") {
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

  return (
    <div class="h-full w-80">
      <div class="flex h-full flex-col rounded-lg bg-black/30 p-4 backdrop-blur-md">
        <h2 class="mb-4 font-bold text-2xl">Medley</h2>
        <div class="relative min-h-0 flex-1">
          <div ref={scrollContainer} class="styled-scrollbars absolute h-full w-full space-y-2 overflow-y-auto">
            <For each={props.songs}>
              {(song, index) => {
                const isSelected = () => position() === index();
                return (
                  <div
                    ref={setItemRef(index())}
                    class="group relative grid overflow-hidden rounded-lg transition-all duration-250"
                    classList={{
                      "bg-white/10": !isSelected(),
                      "shadow-lg": isSelected(),
                    }}
                  >
                    <div
                      class="col-start-1 row-start-1 h-full w-full bg-linear-to-r transition-opacity duration-250"
                      classList={{
                        "gradient-sing": true,
                        "opacity-0": !isSelected(),
                        "opacity-90": isSelected(),
                      }}
                    />
                    <div class="z-2 col-start-1 row-start-1 flex items-center justify-between p-3">
                      <div>
                        <div class="font-medium text-sm">{song.title}</div>
                        <div class="text-xs opacity-80">{song.artist}</div>
                      </div>

                      <div class="flex items-center gap-1">
                        <div
                          class="opacity-0 transition-opacity duration-250"
                          classList={{ "opacity-100": isSelected() }}
                        >
                          <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLT class="text-xs" />}>
                            <IconF2Key class="text-xs" />
                          </Show>
                        </div>
                        <button
                          type="button"
                          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/40 opacity-0 transition-all duration-250 hover:bg-black/60 active:scale-95 group-hover:opacity-100"
                          classList={{ "opacity-100": isSelected() }}
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
          </div>
        </div>
      </div>
    </div>
  );
}
