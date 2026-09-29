import { createEffect, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { Motion } from "solid-motionone";

import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { playSound } from "~/lib/sound";

import Plate from "../ui/plate";

export interface MenuPopupItem {
  label: JSX.Element;
  /** Key glyph(s) for the item's direct shortcut, if it has one. */
  hint?: JSX.Element;
  action: () => void;
}

interface MenuPopupProps {
  items: MenuPopupItem[];
  onClose: () => void;
}

/** Dropdown menu anchored below its trigger, driven by keyboard, gamepad or mouse. */
export function MenuPopup(props: MenuPopupProps) {
  const options = () => props.items;

  const { position, increment, decrement, set } = createLoop(() => options().length);
  let popupRef!: HTMLDivElement;

  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef && !popupRef.contains(event.target as Node)) {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const [pressed, setPressed] = createSignal(false);

  useNavigation({
    layer: 2,
    onKeydown(event) {
      if (event.action === "back" || event.action === "menu") {
        props.onClose();
        playSound("confirm");
      } else if (event.action === "up") {
        decrement();
        playSound("select");
      } else if (event.action === "down") {
        increment();
        playSound("select");
      } else if (event.action === "confirm") {
        setPressed(true);
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        options()[position()]?.action();
        props.onClose();
        playSound("confirm");
      }
    },
  });

  return (
    <div class="absolute top-full right-0 z-20 mt-2" ref={popupRef}>
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        class="w-70 rounded-xl glass p-2"
      >
        <div class="flex flex-col gap-1">
          <For each={options()}>
            {(option, index) => {
              const isSelected = () => position() === index();
              const isActive = () => isSelected() && pressed();
              return (
                <Plate
                  as="button"
                  size="sm"
                  class="w-full"
                  gradient="gradient-sing"
                  selected={isSelected()}
                  pressed={isActive()}
                  contentClass="flex items-center px-4 font-bold"
                  onClick={() => {
                    set(index());
                    option.action();
                    props.onClose();
                    playSound("confirm");
                  }}
                  onMouseEnter={() => set(index())}
                >
                  <span class="flex w-full items-center justify-between gap-4">
                    <span>{option.label}</span>
                    <Show when={option.hint}>
                      <span class="flex items-center gap-1 text-sm opacity-80">{option.hint}</span>
                    </Show>
                  </span>
                </Plate>
              );
            }}
          </For>
        </div>
      </Motion.div>
    </div>
  );
}
