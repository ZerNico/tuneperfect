import { createEffect, Index, type JSX, Match, on, Switch, untrack } from "solid-js";
import { twMerge } from "tailwind-merge";

import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { playSound } from "~/lib/sound";

import Button from "./ui/button";
import Input from "./ui/input";
import Select from "./ui/select";
import Slider from "./ui/slider";

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
  | {
      type: "select-string";
      label: string;
      value: () => string | null;
      onChange: (value: string) => void;
      options: string[];
      renderValue?: (value: string | null) => JSX.Element;
    }
  | {
      type: "select-number";
      label: string;
      value: () => number | null;
      onChange: (value: number) => void;
      options: number[];
      renderValue?: (value: number | null) => JSX.Element;
    }
  | {
      type: "select-string-number";
      label: string;
      value: () => string | number | null;
      onChange: (value: string | number) => void;
      options: (string | number)[];
      renderValue?: (value: string | number | null) => JSX.Element;
    }
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
  // Filter to only interactive items for navigation
  const interactiveIndices = () =>
    props.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type !== "custom" || item.interactive !== false)
      .map(({ index }) => index);

  const { position, increment, decrement, set } = createLoop(() => interactiveIndices().length);
  let scrollContainer: HTMLDivElement | undefined;
  const itemRefs: (HTMLElement | undefined)[] = [];

  // Convert interactive position to actual item index
  const actualIndex = () => interactiveIndices()[position()] ?? 0;

  // Convert actual item index to interactive position
  const toInteractivePosition = (index: number) => {
    const pos = interactiveIndices().indexOf(index);
    return pos >= 0 ? pos : 0;
  };

  // Jump to the initial item once, as soon as it's there (items may arrive after a query).
  let startApplied = false;
  createEffect(() => {
    const start = props.initialIndex;
    if (startApplied || start === undefined || start >= props.items.length) return;
    startApplied = true;
    untrack(() => set(toInteractivePosition(start)));
  });

  const setItemRef = (index: number) => (el: HTMLElement) => {
    itemRefs[index] = el;
  };

  useNavigation(() => ({
    layer: props.layer,
    onKeydown(event) {
      if (event.action === "back") {
        props.onBack?.();
        playSound("confirm");
      } else if (event.action === "up") {
        decrement();
        scrollToSelected();
      } else if (event.action === "down") {
        increment();
        scrollToSelected();
      }
    },
  }));

  createEffect(on(position, () => playSound("select"), { defer: true }));

  const scrollToSelected = () => {
    const selectedItem = itemRefs[actualIndex()];
    if (selectedItem && scrollContainer) {
      selectedItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  return (
    <div class={twMerge("flex h-full max-h-full w-full grow flex-col", props.class)}>
      <div ref={scrollContainer} class="styled-scrollbars flex min-h-0 grow flex-col overflow-y-auto">
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
                      ref={setItemRef(index)}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      selected={actualIndex() === index}
                      onClick={() => {
                        item().action?.();
                        playSound("confirm");
                      }}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                    >
                      {item().label}
                    </Button>
                  )}
                </Match>
                <Match when={ofType(item(), "input")}>
                  {(item) => (
                    <Input
                      ref={setItemRef(index)}
                      class="shrink-0"
                      layer={props.layer}
                      gradient={props.gradient || "gradient-settings"}
                      label={item().label}
                      value={item().value()}
                      placeholder={item().placeholder}
                      onInput={(e) => item().onInput(e.currentTarget.value)}
                      selected={actualIndex() === index}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                      maxLength={item().maxLength}
                      type={item().inputType}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "select-string")}>
                  {(item) => (
                    <Select
                      ref={setItemRef(index)}
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
                      selected={actualIndex() === index}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "select-number")}>
                  {(item) => (
                    <Select
                      ref={setItemRef(index)}
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
                      selected={actualIndex() === index}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "select-string-number")}>
                  {(item) => (
                    <Select
                      ref={setItemRef(index)}
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
                      selected={actualIndex() === index}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "slider")}>
                  {(item) => (
                    <Slider
                      ref={setItemRef(index)}
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
                      selected={actualIndex() === index}
                      onMouseEnter={() => set(toInteractivePosition(index))}
                      renderValue={item().renderValue}
                    />
                  )}
                </Match>
                <Match when={ofType(item(), "custom")}>
                  {(item) => (
                    <div
                      ref={setItemRef(index)}
                      class="shrink-0"
                      onMouseEnter={() =>
                        item().interactive !== false ? set(toInteractivePosition(index)) : undefined
                      }
                    >
                      {item().render({
                        selected: () => actualIndex() === index,
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
