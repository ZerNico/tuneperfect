import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import IconDiceFive from "~icons/ph/dice-five-fill";

import { clamp, easeOutQuart, prefersReducedMotion, useFrame, useInView } from "~/lib/motion";

export const SONGS = [
  ["Queen", "Bohemian Rhapsody"],
  ["ABBA", "Dancing Queen"],
  ["a-ha", "Take On Me"],
  ["Toto", "Africa"],
  ["The Killers", "Mr. Brightside"],
  ["Spice Girls", "Wannabe"],
  ["Britney Spears", "Toxic"],
  ["OutKast", "Hey Ya!"],
  ["Amy Winehouse", "Valerie"],
  ["Lady Gaga", "Shallow"],
] as const;
const COVERS = SONGS.length * 8;
/** Cover width plus gap, in cqw. */
const STEP = 12.5;
const COVER = 11;
const SPIN_MS = 3000;
const HOLD_MS = 3200;

/** Drawn stand-in covers: no album art to license. */
export function Cover(props: { index: number }) {
  const hue = () => (props.index * 47) % 360;
  const song = () => SONGS[props.index % SONGS.length]!;
  return (
    <div
      class="relative size-full overflow-hidden"
      style={{ background: `linear-gradient(135deg, hsl(${hue()} 70% 58%), hsl(${hue() + 50} 65% 32%))` }}
    >
      <Show when={props.index % 2 === 0}>
        <div class="absolute -right-[2cqw] -bottom-[2cqw] size-[8cqw] rounded-full border-[1cqw] border-white/25" />
      </Show>
      <Show when={props.index % 2 === 1}>
        <span class="absolute -top-[1.4cqw] left-[0.4cqw] text-[8cqw] leading-none font-bold text-white/20">
          {song()[1][0]}
        </span>
      </Show>
    </div>
  );
}

function Player(props: { name: string; initial: string; avatar: string; gradient: string; joker: string }) {
  return (
    <div
      class={`flex w-[19cqw] flex-col items-center gap-[1cqw] rounded-[1.6cqw] pt-[2cqw] pb-[1.6cqw] shadow-crisp ${props.gradient}`}
    >
      <span
        class="flex size-[7cqw] items-center justify-center rounded-full text-[3.4cqw] font-bold"
        style={{ background: props.avatar }}
      >
        {props.initial}
      </span>
      <span class="text-[2.2cqw] font-bold">{props.name}</span>
      <span class="flex items-center gap-[0.5cqw]">
        <span class="flex h-[2cqw] min-w-[2cqw] items-center justify-center rounded-[0.4cqw] bg-white px-[0.3cqw] text-[1cqw] font-bold text-[#101024]">
          {props.joker}
        </span>
        <For each={[0, 1, 2]}>
          {() => (
            <span class="flex size-[2cqw] items-center justify-center rounded-[0.4cqw] bg-white/25 text-[1.3cqw]">
              <IconDiceFive />
            </span>
          )}
        </For>
      </span>
    </div>
  );
}

/** Versus, running by itself: two players, jokers, and the song roulette landing again and again. */
export default function VersusScreen() {
  const [element, setElement] = createSignal<HTMLDivElement>();
  const inView = useInView(element, "-15% 0px");
  const [position, setPosition] = createSignal(5);
  const [landed, setLanded] = createSignal(true);
  let spin: { from: number; to: number; start?: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reduced = false;
  onMount(() => (reduced = prefersReducedMotion()));
  onCleanup(() => clearTimeout(timer));

  const roll = () => {
    if (reduced) return;
    const from = Math.round(position()) % SONGS.length;
    const to = from + SONGS.length * 3 + 1 + Math.floor(Math.random() * (SONGS.length - 1));
    setLanded(false);
    setPosition(from);
    spin = { from, to };
  };

  createEffect(() => {
    if (inView() && !spin) roll();
    if (!inView()) clearTimeout(timer);
  });

  useFrame((_, now) => {
    if (!spin) return;
    spin.start ??= now;
    const k = clamp((now - spin.start) / SPIN_MS);
    setPosition(spin.from + (spin.to - spin.from) * easeOutQuart(k));
    if (k >= 1) {
      spin = undefined;
      setLanded(true);
      timer = setTimeout(() => inView() && roll(), HOLD_MS);
    }
  }, inView);

  const selected = () => Math.round(position());
  const song = () => SONGS[selected() % SONGS.length]!;

  return (
    <div
      ref={setElement}
      class="absolute inset-0 flex flex-col items-center justify-center pt-[3cqw]"
      aria-hidden="true"
    >
      <div class="absolute top-[-10%] left-[0%] h-[60%] w-[45%] rounded-full bg-pink-500/25 blur-[8cqw]" />
      <div class="absolute right-[0%] bottom-[-10%] h-[60%] w-[45%] rounded-full bg-purple-600/25 blur-[8cqw]" />
      <span class="absolute top-[4.5cqw] left-[4cqw] text-[2.6cqw] font-bold">Versus</span>

      <div class="relative flex items-center gap-[4cqw]">
        <Player
          name="Nina"
          initial="N"
          avatar="var(--color-orange-500)"
          gradient="bg-linear-to-b from-sky-400 to-blue-700"
          joker="F1"
        />
        <span class="text-[6.5cqw] font-bold text-yellow-400 [text-shadow:0_0.5cqw_0_rgb(0_0_0/0.3)]">VS</span>
        <Player
          name="Max"
          initial="M"
          avatar="var(--color-orange-400)"
          gradient="bg-linear-to-b from-red-400 to-red-700"
          joker="F2"
        />
      </div>

      <div class="relative mt-[2.4cqw] h-[13cqw] w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
        <div
          class="absolute top-[1cqw] left-0 flex gap-[1.5cqw]"
          style={{ transform: `translateX(calc(50cqw - ${COVER / 2}cqw - ${position() * STEP}cqw))` }}
        >
          <For each={Array.from({ length: COVERS })}>
            {(_, index) => (
              <div
                class="size-[11cqw] shrink-0 overflow-hidden rounded-[1.2cqw] transition-[transform,opacity] duration-300 ease-out"
                classList={{
                  "-translate-y-[0.6cqw] outline-[0.35cqw] outline-white": landed() && index() === selected(),
                  "opacity-65": !(landed() && index() === selected()),
                }}
              >
                <Cover index={index()} />
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="relative flex h-[7cqw] flex-col items-center justify-center">
        <Show when={landed()}>
          <span class="animate-[rise_0.35s_ease-out_both] text-[1.4cqw] font-bold text-white/65">{song()[0]}</span>
          <span class="animate-[rise_0.35s_ease-out_0.05s_both] text-[3cqw] leading-tight font-bold">{song()[1]}</span>
        </Show>
      </div>
    </div>
  );
}
