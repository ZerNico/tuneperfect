import { createEventListener } from "@solid-primitives/event-listener";
import { ReactiveMap } from "@solid-primitives/map";
import { access, type MaybeAccessor } from "@solid-primitives/utils";
import mitt from "mitt";
import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { isPrintableKey } from "~/lib/utils/keyboard";
import { createGamepad, type GamepadButton } from "./gamepad";

export const [keyMode, setKeyMode] = createSignal<"gamepad" | "keyboard">("keyboard");

interface UseNavigationOptions {
  layer?: number | false;
  enabled?: boolean;
  onKeydown?: (event: NavigationEvent) => void;
  onKeyup?: (event: NavigationEvent) => void;
  onHold?: (event: NavigationEvent) => void;
  onRepeat?: (event: NavigationEvent) => void;
}

type NavigationEvent = {
  origin: "gamepad" | "keyboard";
  originalKey: string;
  modifiers?: string[];
  action:
    | "left"
    | "right"
    | "up"
    | "down"
    | "back"
    | "confirm"
    | "search"
    | "random"
    | "sort-left"
    | "sort-right"
    | "filter-left"
    | "filter-right"
    | "add-to-medley"
    | "remove-from-medley"
    | "joker-1"
    | "joker-2"
    | "skip"
    | "clear"
    | "fullscreen"
    | "instrumental"
    | "menu"
    | "start-random-medley"
    | "unknown";
};

const KEY_MAPPINGS = new Map<string, NavigationEvent["action"][]>([
  ["ArrowLeft", ["left"]],
  ["ArrowRight", ["right"]],
  ["ArrowUp", ["up"]],
  ["ArrowDown", ["down"]],
  ["Escape", ["back"]],
  ["Enter", ["confirm"]],
  [" ", ["confirm"]],
  ["F3", ["search"]],
  ["F4", ["random"]],
  ["F5", ["sort-left", "filter-left"]],
  ["F6", ["sort-right", "filter-right"]],
  ["F1", ["add-to-medley", "joker-1"]],
  ["F2", ["remove-from-medley", "joker-2"]],
  ["s", ["skip"]],
  ["Backspace", ["clear"]],
  ["Meta+Enter", ["fullscreen"]],
  ["Alt+Enter", ["fullscreen"]],
  ["F11", ["fullscreen"]],
  ["k", ["instrumental"]],
  ["Tab", ["menu"]],
  ["Shift+d", ["start-random-medley"]],
]);

const GAMEPAD_MAPPINGS = new Map<GamepadButton, NavigationEvent["action"][]>([
  ["DPAD_LEFT", ["left"]],
  ["DPAD_RIGHT", ["right"]],
  ["DPAD_UP", ["up"]],
  ["DPAD_DOWN", ["down"]],
  ["B", ["back"]],
  ["A", ["confirm"]],
  ["START", ["search"]],
  ["Y", ["random"]],
  ["LB", ["sort-left", "filter-left", "joker-1", "instrumental"]],
  ["RB", ["sort-right", "filter-right", "joker-2"]],
  ["X", ["menu", "skip", "clear"]],
  ["LT", ["remove-from-medley"]],
  ["RT", ["add-to-medley"]],
]);

const getAxisAction = (button: GamepadButton, direction: number): NavigationEvent["action"] | undefined => {
  switch (button) {
    case "L_AXIS_X":
      return direction > 0 ? "right" : "left";
    case "L_AXIS_Y":
      return direction > 0 ? "down" : "up";
    default:
      return undefined;
  }
};

const getKeyInfo = (event: KeyboardEvent): { keyString: string; originalKey: string; modifiers: string[] } => {
  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.altKey) modifiers.push("Alt");
  if (event.metaKey) modifiers.push("Meta");

  const originalKey = event.key;

  let normalizedKey = originalKey;
  if (originalKey.length === 1 && originalKey >= "A" && originalKey <= "Z") {
    normalizedKey = originalKey.toLowerCase();
  }

  const keyString = modifiers.length > 0 ? `${modifiers.join("+")}+${normalizedKey}` : normalizedKey;

  return { keyString, originalKey, modifiers };
};

type Events = {
  keydown: NavigationEvent;
  keyup: NavigationEvent;
  hold: NavigationEvent;
  repeat: NavigationEvent;
};

const emitter = mitt<Events>();
const pressedKeys = new Map<string, { holdTimeout: number; repeatInterval?: number }>();
const pressedGamepadButtons = new Map<string, { holdTimeout: number; repeatInterval?: number }>();
const HOLD_DELAY = 400;
const REPEAT_DELAY = 50;

createEventListener(document, "keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    if (isPrintableKey(event.key) || ["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }
  }

  event.preventDefault();

  if (event.repeat) return;

  const { keyString, originalKey, modifiers } = getKeyInfo(event);
  const actionsArray = KEY_MAPPINGS.get(keyString);

  setKeyMode("keyboard");

  if (actionsArray && actionsArray.length > 0) {
    const existingTimers = pressedKeys.get(keyString);
    if (existingTimers) {
      clearTimeout(existingTimers.holdTimeout);
      if (existingTimers.repeatInterval) {
        clearInterval(existingTimers.repeatInterval);
      }
    }

    const holdTimeout = window.setTimeout(() => {
      for (const action of actionsArray) {
        emitter.emit("hold", {
          origin: "keyboard",
          originalKey,
          modifiers: modifiers.length > 0 ? modifiers : undefined,
          action,
        });
      }

      const repeatInterval = window.setInterval(() => {
        for (const action of actionsArray) {
          emitter.emit("repeat", {
            origin: "keyboard",
            originalKey,
            modifiers: modifiers.length > 0 ? modifiers : undefined,
            action,
          });
        }
      }, REPEAT_DELAY);

      pressedKeys.set(keyString, { holdTimeout, repeatInterval });
    }, HOLD_DELAY);

    pressedKeys.set(keyString, { holdTimeout });

    for (const action of actionsArray) {
      emitter.emit("keydown", {
        origin: "keyboard",
        originalKey,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        action,
      });
    }
  } else {
    emitter.emit("keydown", {
      origin: "keyboard",
      originalKey,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      action: "unknown",
    });

    const holdTimeout = window.setTimeout(() => {
      emitter.emit("hold", {
        origin: "keyboard",
        originalKey,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        action: "unknown",
      });

      const repeatInterval = window.setInterval(() => {
        emitter.emit("repeat", {
          origin: "keyboard",
          originalKey,
          modifiers: modifiers.length > 0 ? modifiers : undefined,
          action: "unknown",
        });
      }, REPEAT_DELAY);

      pressedKeys.set(keyString, { holdTimeout, repeatInterval });
    }, HOLD_DELAY);

    pressedKeys.set(keyString, { holdTimeout });
  }
});

createEventListener(document, "keyup", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    if (isPrintableKey(event.key) || ["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }
  }

  event.preventDefault();
  if (event.repeat) return;

  const { keyString, originalKey, modifiers } = getKeyInfo(event);

  const timeouts = pressedKeys.get(keyString);
  if (timeouts) {
    clearTimeout(timeouts.holdTimeout);
    if (timeouts.repeatInterval) {
      clearInterval(timeouts.repeatInterval);
    }
    pressedKeys.delete(keyString);
  }

  const actionsArray = KEY_MAPPINGS.get(keyString);
  if (actionsArray && actionsArray.length > 0) {
    for (const action of actionsArray) {
      emitter.emit("keyup", {
        origin: "keyboard",
        originalKey,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        action,
      });
    }
  } else {
    // Handle unknown key
    emitter.emit("keyup", {
      origin: "keyboard",
      originalKey,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      action: "unknown",
    });
  }
});

createGamepad({
  onButtonDown: (event) => {
    setKeyMode("gamepad");
    const actionsArray = GAMEPAD_MAPPINGS.get(event.button);

    if (actionsArray && actionsArray.length > 0 && actionsArray[0] !== "unknown") {
      const existingTimers = pressedGamepadButtons.get(event.button);
      if (existingTimers) {
        clearTimeout(existingTimers.holdTimeout);
        if (existingTimers.repeatInterval) {
          clearInterval(existingTimers.repeatInterval);
        }
      }

      const holdTimeout = window.setTimeout(() => {
        for (const action of actionsArray) {
          if (action === "unknown") continue;
          emitter.emit("hold", {
            origin: "gamepad",
            originalKey: event.button,
            action,
          });
        }

        const repeatInterval = window.setInterval(() => {
          for (const action of actionsArray) {
            if (action === "unknown") continue;
            emitter.emit("repeat", {
              origin: "gamepad",
              originalKey: event.button,
              action,
            });
          }
        }, REPEAT_DELAY);
        pressedGamepadButtons.set(event.button, { holdTimeout, repeatInterval });
      }, HOLD_DELAY);

      pressedGamepadButtons.set(event.button, { holdTimeout });

      for (const action of actionsArray) {
        if (action === "unknown") continue;
        emitter.emit("keydown", {
          origin: "gamepad",
          originalKey: event.button,
          action,
        });
      }
      return;
    }

    if (!event.direction) return;

    const axisAction = getAxisAction(event.button, event.direction);
    if (axisAction) {
      emitter.emit("keydown", {
        origin: "gamepad",
        originalKey: event.button,
        action: axisAction,
      });

      const holdTimeout = window.setTimeout(() => {
        emitter.emit("hold", {
          origin: "gamepad",
          originalKey: event.button,
          action: axisAction,
        });

        const repeatInterval = window.setInterval(() => {
          emitter.emit("repeat", {
            origin: "gamepad",
            originalKey: event.button,
            action: axisAction,
          });
        }, REPEAT_DELAY);

        pressedGamepadButtons.set(event.button, { holdTimeout, repeatInterval });
      }, HOLD_DELAY);

      pressedGamepadButtons.set(event.button, { holdTimeout });
    }
  },
  onButtonUp: (event) => {
    const timeouts = pressedGamepadButtons.get(event.button);
    if (timeouts) {
      clearTimeout(timeouts.holdTimeout);
      if (timeouts.repeatInterval) {
        clearInterval(timeouts.repeatInterval);
      }
      pressedGamepadButtons.delete(event.button);
    }

    const actionsArray = GAMEPAD_MAPPINGS.get(event.button);
    if (actionsArray) {
      for (const action of actionsArray) {
        if (action === "unknown") continue;
        emitter.emit("keyup", {
          origin: "gamepad",
          originalKey: event.button,
          action,
        });
      }
      return;
    }

    const axisAction = getAxisAction(event.button, event.direction ?? 0);
    if (axisAction) {
      emitter.emit("keyup", {
        origin: "gamepad",
        originalKey: event.button,
        action: axisAction,
      });
    }
  },
});

const layerInstances = new ReactiveMap<number, number>();

export function useNavigation(options: MaybeAccessor<UseNavigationOptions>) {
  createEffect(
    on(
      () => access(options),
      (options) => {
        if (options.enabled === false || options.layer === false) return;

        const layer = options.layer ?? 0;
        layerInstances.set(layer, (layerInstances.get(layer) ?? 0) + 1);

        onCleanup(() => {
          const current = layerInstances.get(layer) || 0;
          if (current <= 1) {
            layerInstances.delete(layer);
          } else {
            layerInstances.set(layer, current - 1);
          }
        });
      },
    ),
  );

  const isActive = createMemo(() => {
    const opts = access(options);
    if (opts?.enabled === false) return false;

    const layer = opts.layer ?? 0;
    if (layer === false) return true;

    const highestLayer = Math.max(...layerInstances.keys());
    return layer === highestLayer;
  });

  createEffect(() => {
    if (!isActive()) return;

    const opts = access(options);
    if (opts?.enabled === false) return;

    const handleKeydown = (e: NavigationEvent) => opts?.onKeydown?.(e);
    const handleKeyup = (e: NavigationEvent) => opts?.onKeyup?.(e);
    const handleHold = (e: NavigationEvent) => opts?.onHold?.(e);
    const handleRepeat = (e: NavigationEvent) => opts?.onRepeat?.(e);

    emitter.on("keydown", handleKeydown);
    emitter.on("keyup", handleKeyup);
    emitter.on("hold", handleHold);
    emitter.on("repeat", handleRepeat);

    onCleanup(() => {
      emitter.off("keydown", handleKeydown);
      emitter.off("keyup", handleKeyup);
      emitter.off("hold", handleHold);
      emitter.off("repeat", handleRepeat);
    });
  });

  return { isActive };
}
