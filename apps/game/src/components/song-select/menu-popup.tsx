import { For, type JSX, Show } from "solid-js";
import { Motion } from "solid-motionone";

import { createClickOutside } from "~/hooks/click-outside";
import { createListNavigation } from "~/hooks/list-navigation";
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
  let popupRef!: HTMLDivElement;
  createClickOutside(
    () => popupRef,
    () => props.onClose(),
  );

  const activate = (index: number) => {
    props.items[index]?.action();
    props.onClose();
    playSound("confirm");
  };

  const list = createListNavigation({
    get count() {
      return props.items.length;
    },
    layer: 2,
    onActivate: activate,
    onKeydown(event) {
      if (event.action === "back" || event.action === "menu") {
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
          <For each={props.items}>
            {(option, index) => (
              <Plate
                as="button"
                size="sm"
                class="w-full"
                gradient="gradient-sing"
                selected={list.isSelected(index())}
                pressed={list.isSelected(index()) && list.pressed()}
                contentClass="flex items-center px-4 font-bold"
                onClick={() => activate(index())}
                onMouseEnter={() => list.set(index())}
              >
                <span class="flex w-full items-center justify-between gap-4">
                  <span>{option.label}</span>
                  <Show when={option.hint}>
                    <span class="flex items-center gap-1 text-sm opacity-80">{option.hint}</span>
                  </Show>
                </span>
              </Plate>
            )}
          </For>
        </div>
      </Motion.div>
    </div>
  );
}
