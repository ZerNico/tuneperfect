import { For, type JSX } from "solid-js";
import { keyMode } from "~/hooks/navigation";
import { t } from "~/lib/i18n";

import IconDownArrowKey from "~icons/sing/down-arrow-key";
import IconEnterKey from "~icons/sing/enter-key";
import IconEscKey from "~icons/sing/esc-key";
import IconGamepadA from "~icons/sing/gamepad-a";
import IconGamepadB from "~icons/sing/gamepad-b";
import IconGamepadDPad from "~icons/sing/gamepad-dpad";
import IconLeftArrowKey from "~icons/sing/left-arrow-key";
import IconRightArrowKey from "~icons/sing/right-arrow-key";
import IconUpArrowKey from "~icons/sing/up-arrow-key";

type HintType = "navigate" | "confirm" | "back";

interface KeyHintsProps {
  hints: HintType[];
}

export default function KeyHints(props: KeyHintsProps) {
  const getIcon = (type: HintType) => {
    const isGamepad = keyMode() === "gamepad";

    switch (type) {
      case "back":
        return isGamepad ? <IconGamepadB /> : <IconEscKey />;
      case "confirm":
        return isGamepad ? <IconGamepadA /> : <IconEnterKey />;
      case "navigate":
        return isGamepad ? (
          <IconGamepadDPad />
        ) : (
          <div class="flex flex-col items-center gap-0.5 text-xs">
            <IconUpArrowKey />
            <div class="flex gap-0.5">
              <IconLeftArrowKey />
              <IconDownArrowKey />
              <IconRightArrowKey />
            </div>
          </div>
        );
    }
  };

  return (
    <div class="flex items-center gap-8 text-base">
      <For each={props.hints}>
        {(hint) => {
          const label = t(`common.keyHints.${hint}`);
          return <KeyHint label={label} icon={getIcon(hint)} />;
        }}
      </For>
    </div>
  );
}

interface KeyHintProps {
  label: string;
  icon: JSX.Element;
}
function KeyHint(props: KeyHintProps) {
  return (
    <div class="flex items-center gap-2">
      {props.icon} {props.label}
    </div>
  );
}
