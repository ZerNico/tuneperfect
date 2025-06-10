import { makeEventListener } from "@solid-primitives/event-listener";
import { createRAF } from "@solid-primitives/raf";
import { access, type MaybeAccessor } from "@solid-primitives/utils";

export type GamepadButton =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "LT"
  | "RT"
  | "BACK"
  | "START"
  | "LS"
  | "RS"
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "DPAD_LEFT"
  | "DPAD_RIGHT"
  | "XBOX"
  | "L_AXIS_X"
  | "L_AXIS_Y"
  | "R_AXIS_X"
  | "R_AXIS_Y"
  | "UNKNOWN";

interface GamepadButtonEvent {
  button: GamepadButton;
  repeat: boolean;
  gamepadId: number;
  direction?: number;
}

interface CreateGamepadOptions {
  onButtonDown?: (event: GamepadButtonEvent) => void;
  onButtonUp?: (event: GamepadButtonEvent) => void;
}

const AXIS_THRESHOLD = 0.5;

const BUTTON_MAPPINGS = new Map<number, GamepadButton>([
  [0, "A"],
  [1, "B"],
  [2, "X"],
  [3, "Y"],
  [4, "LB"],
  [5, "RB"],
  [6, "LT"],
  [7, "RT"],
  [8, "BACK"],
  [9, "START"],
  [10, "LS"],
  [11, "RS"],
  [12, "DPAD_UP"],
  [13, "DPAD_DOWN"],
  [14, "DPAD_LEFT"],
  [15, "DPAD_RIGHT"],
  [16, "XBOX"],
]);

const AXIS_MAPPINGS = new Map<number, GamepadButton>([
  [0, "L_AXIS_X"],
  [1, "L_AXIS_Y"],
  [2, "R_AXIS_X"],
  [3, "R_AXIS_Y"],
]);

export function createGamepad(options: MaybeAccessor<CreateGamepadOptions>) {
  const buttonStates = new Map<number, Map<number, boolean>>();
  const axisStates = new Map<number, Map<number, number>>();

  const currentGamepads = navigator.getGamepads();
  for (const gamepad of currentGamepads) {
    if (!gamepad) continue;
    buttonStates.set(gamepad.index, new Map());
    axisStates.set(gamepad.index, new Map());
  }

  const handleGamepadConnected = (e: GamepadEvent) => {
    const gamepad = e.gamepad;
    buttonStates.set(gamepad.index, new Map());
    axisStates.set(gamepad.index, new Map());
  };

  const handleGamepadDisconnected = (e: GamepadEvent) => {
    const gamepad = e.gamepad;
    buttonStates.delete(gamepad.index);
    axisStates.delete(gamepad.index);
  };

  const updateGamepadState = () => {
    const currentGamepads = navigator.getGamepads();
    const opts = access(options);

    for (const gamepad of currentGamepads) {
      if (!gamepad) continue;

      const gamepadButtonStates = buttonStates.get(gamepad.index);
      const gamepadAxisStates = axisStates.get(gamepad.index);

      if (!gamepadButtonStates || !gamepadAxisStates) continue;

      for (const [index, button] of gamepad.buttons.entries()) {
        const prevState = gamepadButtonStates.get(index) || false;
        const currentState = button.pressed;

        if (currentState !== prevState) {
          const buttonName = BUTTON_MAPPINGS.get(index) || "UNKNOWN";
          const event: GamepadButtonEvent = {
            button: buttonName,
            repeat: false,
            gamepadId: gamepad.index,
          };

          if (currentState && opts.onButtonDown) {
            opts.onButtonDown(event);
          } else if (!currentState && opts.onButtonUp) {
            opts.onButtonUp(event);
          }

          gamepadButtonStates.set(index, currentState);
        }
      }

      for (const [index, value] of gamepad.axes.entries()) {
        const prevValue = gamepadAxisStates.get(index) || 0;

        const prevCrossedThreshold = Math.abs(prevValue) > AXIS_THRESHOLD;
        const currentCrossesThreshold = Math.abs(value) > AXIS_THRESHOLD;

        if (
          currentCrossesThreshold !== prevCrossedThreshold ||
          (currentCrossesThreshold && Math.sign(value) !== Math.sign(prevValue))
        ) {
          const axisName = AXIS_MAPPINGS.get(index);
          if (!axisName) continue;

          const event: GamepadButtonEvent = {
            button: axisName,
            repeat: false,
            gamepadId: gamepad.index,
            direction: currentCrossesThreshold ? value : 0,
          };

          if (currentCrossesThreshold && opts.onButtonDown) {
            opts.onButtonDown(event);
          } else if (!currentCrossesThreshold && opts.onButtonUp) {
            opts.onButtonUp(event);
          }
        }

        gamepadAxisStates.set(index, value);
      }
    }
  };

  makeEventListener(window, "gamepadconnected", handleGamepadConnected);
  makeEventListener(window, "gamepaddisconnected", handleGamepadDisconnected);
  const [_running, start] = createRAF(updateGamepadState);
  start();
}
