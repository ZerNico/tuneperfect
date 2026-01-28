import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Motion } from "solid-motionone";
import { createLoop } from "~/hooks/loop";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import IconF1Key from "~icons/sing/f1-key";
import IconGamepadRT from "~icons/sing/gamepad-rt";
import IconShiftKey from "~icons/sing/shift-key";

interface MenuPopupProps {
  onClose: () => void;
  onStartRandomMedley: () => void;
  onAddToMedley: () => void;
}

export function MenuPopup(props: MenuPopupProps) {
  const options = [
    {
      label: (
        <div class="flex w-full items-center justify-between">
          <span>{t("sing.menu.addToMedley")}</span>
          <div class="flex items-center gap-1">
            <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRT class="text-sm" />}>
              <IconF1Key class="text-sm" />
            </Show>
          </div>
        </div>
      ),
      action: props.onAddToMedley,
    },
    {
      label: (
        <div class="flex w-full items-center justify-between">
          <span>{t("sing.menu.startRandomMedley")}</span>
          <div class="flex items-center gap-1">
            <Show when={keyMode() === "keyboard"}>
              <IconShiftKey class="text-sm" />
              <span class="font-bold text-xs">+</span>
              <span class="font-bold text-sm">D</span>
            </Show>
          </div>
        </div>
      ),
      action: props.onStartRandomMedley,
    },
  ];

  const { position, increment, decrement, set } = createLoop(() => options.length);
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
        options[position()]?.action();
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
        class="w-70 rounded-lg bg-black/30 p-2 shadow-xl backdrop-blur-md"
      >
        <div class="flex flex-col gap-1">
          <For each={options}>
            {(option, index) => {
              const isSelected = () => position() === index();
              const isActive = () => isSelected() && pressed();
              return (
                <button
                  type="button"
                  class="group relative grid w-full overflow-hidden rounded-lg text-left transition-all duration-250 active:scale-95"
                  classList={{
                    "bg-white/10": !isSelected(),
                    "shadow-lg": isSelected(),
                    "scale-95": isActive(),
                  }}
                  onClick={() => {
                    set(index());
                    option.action();
                    props.onClose();
                    playSound("confirm");
                  }}
                  onMouseEnter={() => set(index())}
                >
                  <div
                    class="col-start-1 row-start-1 h-full w-full bg-linear-to-r transition-opacity duration-250"
                    classList={{
                      "gradient-sing": true,
                      "opacity-0": !isSelected(),
                      "opacity-90": isSelected(),
                    }}
                  />
                  <div class="z-2 col-start-1 row-start-1 p-3 font-medium">{option.label}</div>
                </button>
              );
            }}
          </For>
        </div>
      </Motion.div>
    </div>
  );
}
