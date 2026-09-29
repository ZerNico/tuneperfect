import { createEffect, createMemo, createSelector, Index, type JSX, Match, Switch, untrack } from "solid-js";
import { twMerge } from "tailwind-merge";

import { createListNavigation } from "~/hooks/list-navigation";
import { playSound } from "~/lib/sound";

import Button from "./ui/button";
import Input from "./ui/input";
import Select from "./ui/select";
import Slider from "./ui/slider";

/** A value picked with left/right from a fixed list of options. */
interface SelectItem<T extends string | number> {
  type: "select";
  label: string;
  value: () => T | null;
  onChange: (value: T) => void;
  options: T[];
  renderValue?: (value: T | null) => JSX.Element;
}

/** Builds a select item; keeps the value type for `value`, `onChange` and `renderValue`. */
export function select<T extends string | number>(item: Omit<SelectItem<T>, "type">): MenuItem {
  // Widening T is safe here: the Select only ever hands back values taken from `options`.
  return { type: "select", ...item } as unknown as MenuItem;
}

export type MenuItem =
  | {
      type: "slider";
      label: string;
      value: () => number;
      min: number;
      max: number;
      step: number;
      onInput: (value: number) => void;
      renderValue?: (value: number) => JSX.Element;
    }
  | {
      type: "button";
      label: string | JSX.Element;
      action?: () => void;
    }
  | SelectItem<string | number>
  | {
      type: "input";
      label: string;
      value: () => string;
      onInput: (value: string) => void;
      placeholder?: string;
      maxLength?: number;
      inputType?: "text" | "password";
    }
  | {
      type: "custom";
      interactive?: boolean;
      render: (context: { selected: () => boolean; gradient: () => string }) => JSX.Element;
    };

export interface MenuProps {
  items: MenuItem[];
  onBack?: () => void;
  gradient?: "gradient-settings" | "gradient-lobby" | "gradient-sing" | "gradient-party";
  layer?: number;
  class?: string;
  /** Item to start on (e.g. the current choice). Applied once it exists, since items may load later. */
  initialIndex?: number;
}

/** The item as its specific type if it has that type (narrows for `<Match>`). */
const ofType = <K extends MenuItem["type"]>(item: MenuItem, type: K) =>
  item.type === type ? (item as Extract<MenuItem, { type: K }>) : undefined;

export default function Menu(props: MenuProps) {
  // Only interactive items take part in navigation; positions count those.
  const interactiveIndices = createMemo(() =>
    props.items.flatMap((item, index) => (item.type !== "custom" || item.interactive !== false ? [index] : [])),
  );
  const positions = createMemo(() => new Map(interactiveIndices().map((index, position) => [index, position])));
  /** The item's position among the interactive items, -1 if it isn't one. */
  const positionOf = (index: number) => positions().get(index) ?? -1;

  const list = createListNavigation({
    get count() {
      return interactiveIndices().length;
    },
    get layer() {
      return props.layer;
    },
    onKeydown(event) {
      if (event.action === "back") {
        props.onBack?.();
        playSound("confirm");
      }
    },
  });

  const isSelected = createSelector(() => interactiveIndices()[list.position()] ?? 0);
  const select = (index: number) => list.set(Math.max(0, positionOf(index)));

  // Jump to the initial item once, as soon as it's there (items may arrive after a query).
  let startApplied = false;
  createEffect(() => {
    const start = props.initialIndex;
    if (startApplied || start === undefined || start >= props.items.length) return;
    startApplied = true;
    untrack(() => select(start));
  });

  return (
    <div class={twMerge("flex h-full max-h-full w-full grow flex-col", props.class)}>
      <div class="styled-scrollbars flex min-h-0 grow flex-col overflow-y-auto">
        {/* Side padding leaves room for the slant and the selection marker. */}
        <div class="m-auto flex w-full max-w-280 shrink-0 flex-col gap-2.5 px-12 py-3">
          {/* By position, not identity: menus that rebuild their items on every change keep their rows
              (and their state and animations) instead of recreating them. */}
          <Index each={props.items}>
            {(item, index) => (
              <Switch>
                <Match when={ofType(item(), "button")}>
                  {(item) => (
                    <Button
                      ref={list.itemRef(() => positionOf(index))}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      selected={isSelected(index)}
                      onClick={() => {
                        item().action?.();
                        playSound("confirm");
                      }}
                      onMouseEnter={() => select(index)}
                    >
                      {item().label}
                    </Button>
                  )}
                </Match>
                <Match when={ofType(item(), "input")}>
                  {(item) => (
                    <Input
                      ref={list.itemRef(() => positionOf(index))}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      label={item().label}
                      value={item().value()}
                      placeholder={item().placeholder}
                      onInput={(e) => item().onInput(e.currentTarget.value)}
                      selected={isSelected(index)}
                      onMouseEnter={() => select(index)}
                      maxLength={item().maxLength}
                      type={item().inputType}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "select")}>
                  {(item) => (
                    <Select
                      ref={list.itemRef(() => positionOf(index))}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      label={item().label}
                      value={item().value()}
                      onChange={(value) => {
                        item().onChange(value);
                        playSound("select");
                      }}
                      options={item().options}
                      selected={isSelected(index)}
                      onMouseEnter={() => select(index)}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "slider")}>
                  {(item) => (
                    <Slider
                      ref={list.itemRef(() => positionOf(index))}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      label={item().label}
                      value={item().value()}
                      min={item().min}
                      max={item().max}
                      step={item().step}
                      onInput={(value) => {
                        item().onInput(value);
                      }}
                      selected={isSelected(index)}
                      onMouseEnter={() => select(index)}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "custom")}>
                  {(item) => (
                    <div
                      ref={list.itemRef(() => positionOf(index))}
                      class="shrink-0"
                      onMouseEnter={() => (item().interactive !== false ? select(index) : undefined)}
                    >
                      {item().render({
                        selected: () => isSelected(index),
                        gradient: () => props.gradient || "gradient-settings",
                      })}
                    </div>
                  )}
                </Match>
              </Switch>
            )}
          </Index>
        </div>
      </div>
    </div>
  );
}
