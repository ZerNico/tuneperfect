import { createEffect, For, type JSX, Match, on, Switch } from "solid-js";
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
    };

export interface MenuProps {
  items: MenuItem[];
  onBack?: () => void;
  gradient?: "gradient-settings" | "gradient-lobby" | "gradient-sing" | "gradient-party";
  layer?: number;
  class?: string;
}

export default function Menu(props: MenuProps) {
  const { position, increment, decrement, set } = createLoop(() => props.items.length);
  let scrollContainer: HTMLDivElement | undefined;
  const itemRefs: (HTMLElement | undefined)[] = [];

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
      } else if (event.action === "down") {
        increment();
      }
    },
  }));

  createEffect(on(position, () => playSound("select"), { defer: true }));

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

  return (
    <div class={twMerge("flex h-full max-h-full w-full flex-grow flex-col justify-center", props.class)}>
      <div
        ref={scrollContainer}
        class="styled-scrollbars flex max-h-full flex-col overflow-y-auto"
        style="max-height: calc(100vh - 12rem);"
      >
        <For each={props.items}>
          {(item, index) => (
            <Switch>
              <Match when={item.type === "button" && item}>
                {(item) => (
                  <Button
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
                    layer={props.layer}
                    gradient={props.gradient || "gradient-settings"}
                    selected={position() === index()}
                    onClick={() => {
                      item().action?.();
                      playSound("confirm");
                    }}
                    onMouseEnter={() => set(index())}
                  >
                    {item().label}
                  </Button>
                )}
              </Match>
              <Match when={item.type === "input" && item}>
                {(item) => (
                  <Input
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
                    layer={props.layer}
                    gradient={props.gradient || "gradient-settings"}
                    label={item().label}
                    value={item().value()}
                    placeholder={item().placeholder}
                    onInput={(e) => item().onInput(e.currentTarget.value)}
                    selected={position() === index()}
                    onMouseEnter={() => set(index())}
                  />
                )}
              </Match>
              <Match when={item.type === "select-string" && item}>
                {(item) => (
                  <Select
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
                    layer={props.layer}
                    gradient={props.gradient || "gradient-settings"}
                    label={item().label}
                    value={item().value()}
                    onChange={(value) => {
                      item().onChange(value);
                      playSound("select");
                    }}
                    options={item().options}
                    selected={position() === index()}
                    onMouseEnter={() => set(index())}
                    renderValue={item().renderValue}
                  />
                )}
              </Match>
              <Match when={item.type === "select-number" && item}>
                {(item) => (
                  <Select
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
                    layer={props.layer}
                    gradient={props.gradient || "gradient-settings"}
                    label={item().label}
                    value={item().value()}
                    onChange={(value) => {
                      item().onChange(value);
                      playSound("select");
                    }}
                    options={item().options}
                    selected={position() === index()}
                    onMouseEnter={() => set(index())}
                    renderValue={item().renderValue}
                  />
                )}
              </Match>
              <Match when={item.type === "select-string-number" && item}>
                {(item) => (
                  <Select
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
                    layer={props.layer}
                    gradient={props.gradient || "gradient-settings"}
                    label={item().label}
                    value={item().value()}
                    onChange={(value) => {
                      item().onChange(value);
                      playSound("select");
                    }}
                    options={item().options}
                    selected={position() === index()}
                    onMouseEnter={() => set(index())}
                    renderValue={item().renderValue}
                  />
                )}
              </Match>
              <Match when={item.type === "slider" && item}>
                {(item) => (
                  <Slider
                    ref={setItemRef(index())}
                    class="flex-shrink-0"
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
                    selected={position() === index()}
                    onMouseEnter={() => set(index())}
                  />
                )}
              </Match>
            </Switch>
          )}
        </For>
      </div>
    </div>
  );
}
