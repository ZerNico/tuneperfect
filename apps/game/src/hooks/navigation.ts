import { createEventListener } from "@solid-primitives/event-listener";
import { ReactiveMap } from "@solid-primitives/map";
import { access, type MaybeAccessor } from "@solid-primitives/utils";
import mitt from "mitt";
import { createEffect, createMemo, createRoot, createSignal, on, onCleanup } from "solid-js";

import { isPrintableKey } from "~/lib/utils/keyboard";

import { createGamepad, type GamepadButton } from "./gamepad";

export const [keyMode, setKeyMode] = createSignal<"gamepad" | "keyboard">("keyboard");

export type NavigationHandler = (event: NavigationEvent) => void;

/** A function runs on key down; the object form reacts to other phases of a press too. */
export type ActionHandler =
  | NavigationHandler
  | {
      down?: NavigationHandler;
      /** Only for presses whose key down this listener got too. */
      up?: NavigationHandler;
      /** Once, after the key has been held for a moment. */
      hold?: NavigationHandler;
      /** Repeatedly while the key stays held, after `hold`. */
      repeat?: NavigationHandler;
    };

export type NavigationActions = Partial<Record<Action, ActionHandler>>;

interface UseNavigationOptions {
  layer?: number | false;
  enabled?: boolean;
  /**
   * What this listener does per action. Only the actions listed count as handled: they're what the
   * screen offers right now (see `activeActions`), so build the map from the current state rather
   * than ignoring actions inside a handler.
   */
  actions: NavigationActions;
}

export type NavigationEvent = {
  origin: "gamepad" | "keyboard" | "remote";
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
    | "filter"
    | "random"
    | "sort-left"
    | "sort-right"
    | "filter-left"
    | "filter-right"
    | "zoom-in"
    | "zoom-out"
    | "add-to-medley"
    | "remove-from-medley"
    | "medley-up"
    | "medley-down"
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

export type Action = NavigationEvent["action"];

const KEY_MAPPINGS = new Map<string, Action[]>([
  ["ArrowLeft", ["left"]],
  ["ArrowRight", ["right"]],
  ["ArrowUp", ["up"]],
  ["ArrowDown", ["down"]],
  ["Escape", ["back"]],
  ["Enter", ["confirm"]],
  [" ", ["confirm"]],
  ["F3", ["search"]],
  ["F4", ["filter"]],
  ["F5", ["random"]],
  ["F6", ["sort-left", "filter-left", "zoom-out"]],
  ["F7", ["sort-right", "filter-right", "zoom-in"]],
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
  ["PageUp", ["medley-up"]],
  ["PageDown", ["medley-down"]],
]);

const GAMEPAD_MAPPINGS = new Map<GamepadButton, Action[]>([
  ["DPAD_LEFT", ["left"]],
  ["DPAD_RIGHT", ["right"]],
  ["DPAD_UP", ["up"]],
  ["DPAD_DOWN", ["down"]],
  ["B", ["back"]],
  ["A", ["confirm"]],
  ["START", ["menu"]],
  ["SELECT", ["random"]],
  ["Y", ["filter"]],
  ["X", ["search", "skip", "clear"]],
  ["LB", ["sort-left", "filter-left", "zoom-out", "joker-1", "instrumental"]],
  ["RB", ["sort-right", "filter-right", "zoom-in", "joker-2"]],
  ["LT", ["remove-from-medley"]],
  ["RT", ["add-to-medley"]],
]);

/** How long a phone's button counts as held: long enough for press feedback, short of a hold. */
const REMOTE_PRESS_MS = 80;

const getAxisAction = (button: GamepadButton, direction: number): Action | undefined => {
  switch (button) {
    case "L_AXIS_X":
      return direction > 0 ? "right" : "left";
    case "L_AXIS_Y":
      return direction > 0 ? "down" : "up";
    case "R_AXIS_Y":
      return direction > 0 ? "medley-down" : "medley-up";
    default:
      return undefined;
  }
};

const getKeyInfo = (event: KeyboardEvent): { keyString: string; modifiers: string[] } => {
  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.altKey) modifiers.push("Alt");
  if (event.metaKey) modifiers.push("Meta");

  let normalizedKey = event.key;
  if (normalizedKey.length === 1 && normalizedKey >= "A" && normalizedKey <= "Z") {
    normalizedKey = normalizedKey.toLowerCase();
  }

  const keyString = modifiers.length > 0 ? `${modifiers.join("+")}+${normalizedKey}` : normalizedKey;

  return { keyString, modifiers };
};

/** Keys that text fields handle themselves while focused. */
const isInputPassthrough = (event: KeyboardEvent) =>
  (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) &&
  (isPrintableKey(event.key) || ["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key));

/** An event plus the physical press it belongs to, so listeners can pair keyups with their keydowns. */
type Emitted = { serial: number; event: NavigationEvent };

type Events = {
  keydown: Emitted;
  keyup: Emitted;
  hold: Emitted;
  repeat: Emitted;
};

/** A key, button or stick direction that is held down, with the actions it had when it went down. */
interface Press {
  serial: number;
  origin: NavigationEvent["origin"];
  originalKey: string;
  modifiers?: string[];
  actions: Action[];
  holdTimeout: number;
  repeatInterval?: number;
}

const emitter = mitt<Events>();
/** Held inputs by source: `key:<code>`, `pad:<gamepad>:<button>`, `axis:<gamepad>:<axis>` or `remote:<user>:<action>`. */
const presses = new Map<string, Press>();
const liveSerials = new Set<number>();
let nextSerial = 0;
const HOLD_DELAY = 400;
const REPEAT_DELAY = 50;

const emit = (type: keyof Events, press: Press) => {
  for (const action of press.actions) {
    emitter.emit(type, {
      serial: press.serial,
      event: { origin: press.origin, originalKey: press.originalKey, modifiers: press.modifiers, action },
    });
  }
};

/** Forgets a press without a keyup, e.g. when the window loses focus mid-press. */
const drop = (id: string) => {
  const press = presses.get(id);
  if (!press) return;
  clearTimeout(press.holdTimeout);
  clearInterval(press.repeatInterval);
  presses.delete(id);
  liveSerials.delete(press.serial);
};

const press = (id: string, input: Pick<Press, "origin" | "originalKey" | "modifiers" | "actions">) => {
  drop(id);

  const state: Press = {
    ...input,
    serial: nextSerial++,
    holdTimeout: window.setTimeout(() => {
      emit("hold", state);
      state.repeatInterval = window.setInterval(() => emit("repeat", state), REPEAT_DELAY);
    }, HOLD_DELAY),
  };
  presses.set(id, state);
  liveSerials.add(state.serial);
  emit("keydown", state);
};

/** Ends a press, emitting keyup for the actions it went down with. */
const release = (id: string) => {
  const state = presses.get(id);
  if (!state) return;
  drop(id);
  emit("keyup", state);
};

const dropWhere = (predicate: (id: string, press: Press) => boolean) => {
  for (const [id, state] of presses) {
    if (predicate(id, state)) drop(id);
  }
};

createRoot(() => {
  createEventListener(document, "keydown", (event) => {
    if (isInputPassthrough(event)) return;

    event.preventDefault();
    if (event.repeat) return;

    setKeyMode("keyboard");

    const { keyString, modifiers } = getKeyInfo(event);
    // By physical key: the key string depends on modifiers, which may change before the keyup.
    press(`key:${event.code || keyString}`, {
      origin: "keyboard",
      originalKey: event.key,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      actions: KEY_MAPPINGS.get(keyString) ?? ["unknown"],
    });
  });

  createEventListener(document, "keyup", (event) => {
    const id = `key:${event.code || getKeyInfo(event).keyString}`;
    // A key that went down outside a text field is released even if a field has focus now.
    if (!presses.has(id) && isInputPassthrough(event)) return;

    event.preventDefault();
    release(id);

    // macOS sends no keyup for keys released while Cmd is down, so end those with Cmd.
    if (event.key === "Meta") {
      for (const [otherId, state] of presses) {
        if (state.origin === "keyboard" && state.modifiers?.includes("Meta")) release(otherId);
      }
    }
  });

  // Keyups are lost while the window is in the background.
  createEventListener(window, "blur", () => dropWhere((id) => id.startsWith("key:")));

  createGamepad({
    onButtonDown: (event) => {
      setKeyMode("gamepad");

      const actions = GAMEPAD_MAPPINGS.get(event.button);
      if (actions) {
        press(`pad:${event.gamepadId}:${event.button}`, {
          origin: "gamepad",
          originalKey: event.button,
          actions,
        });
        return;
      }

      const axisAction = event.direction ? getAxisAction(event.button, event.direction) : undefined;
      if (!axisAction) return;
      const id = `axis:${event.gamepadId}:${event.button}`;
      // The stick flipped to the other side without passing the centre: end the old direction first.
      release(id);
      press(id, { origin: "gamepad", originalKey: event.button, actions: [axisAction] });
    },
    onButtonUp: (event) => {
      release(`pad:${event.gamepadId}:${event.button}`);
      release(`axis:${event.gamepadId}:${event.button}`);
    },
    onDisconnect: (gamepadId) => {
      dropWhere((id) => id.startsWith(`pad:${gamepadId}:`) || id.startsWith(`axis:${gamepadId}:`));
    },
  });
});

/**
 * A button pressed on a phone with full control (see `lib/remote`). It goes down and comes back up
 * like a key, so everything that reacts on key up (buttons, menus) works the same. Doesn't change
 * `keyMode`: the key hints stay on what's used at the game itself.
 */
export function pressRemote(userId: string, action: Action) {
  const id = `remote:${userId}:${action}`;
  press(id, { origin: "remote", originalKey: action, actions: [action] });
  window.setTimeout(() => release(id), REMOTE_PRESS_MS);
}

const layerInstances = new ReactiveMap<number, number>();
/** The actions of every listener that currently gets input, by listener. */
const activeActionLists = new ReactiveMap<object, Action[]>();

/** What the game reacts to right now: the actions of the top layer's listeners (and layer-less ones). */
export const activeActions = createRoot(() =>
  createMemo(() => new Set([...activeActionLists.values()].flat()), undefined, {
    equals: (a, b) => a.size === b.size && [...a].every((action) => b.has(action)),
  }),
);

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

  // Press/action pairs this instance got the keydown for. A keyup is only passed on if its keydown
  // was, so e.g. releasing the key that closed a popup doesn't also trigger the screen below it.
  const received = new Set<string>();

  createEffect(() => {
    if (!isActive()) return;

    const opts = access(options);
    if (opts?.enabled === false) return;
    const actions = opts.actions;

    const registration = {};
    activeActionLists.set(registration, Object.keys(actions) as Action[]);
    onCleanup(() => activeActionLists.delete(registration));

    const phase = (action: Action, name: "down" | "up" | "hold" | "repeat") => {
      const handler = actions[action];
      if (typeof handler === "function") return name === "down" ? handler : undefined;
      return handler?.[name];
    };

    const handleKeydown = ({ serial, event }: Emitted) => {
      if (!(event.action in actions)) return;
      // Forget keydowns whose keyup this instance missed while it was inactive.
      for (const key of received) {
        if (!liveSerials.has(Number.parseInt(key, 10))) received.delete(key);
      }
      received.add(`${serial}:${event.action}`);
      phase(event.action, "down")?.(event);
    };
    const handleKeyup = ({ serial, event }: Emitted) => {
      if (received.delete(`${serial}:${event.action}`)) phase(event.action, "up")?.(event);
    };
    const handleHold = ({ event }: Emitted) => phase(event.action, "hold")?.(event);
    const handleRepeat = ({ event }: Emitted) => phase(event.action, "repeat")?.(event);

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
}
