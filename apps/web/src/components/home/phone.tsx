import { createSignal, For, Index, onMount, Show } from "solid-js";
import IconCheckCircle from "~icons/ph/check-circle-fill";
import IconMicrophone from "~icons/ph/microphone-stage-fill";
import IconQrCode from "~icons/ph/qr-code-bold";
import IconUserCircle from "~icons/ph/user-circle-fill";
import IconUsersThree from "~icons/ph/users-three-fill";

import Glow from "~/components/glow";
import Button from "~/components/ui/button";
import { clamp, prefersReducedMotion, useFrame, useInView } from "~/lib/motion";

import Reveal from "./reveal";

const CODE = "K7QM4XRT";
const JOIN_URL = "app.tuneperfect.org/join";
const HOST = { name: "Nina", color: "var(--color-orange-500)" };
const GUESTS = [
  { name: "Steve", color: "var(--color-teal-500)" },
  { name: "Rimuru", color: "var(--color-purple-500)" },
  { name: "Max", color: "var(--color-orange-400)" },
];
/** One guest joining: typing the code, tapping Join, showing up in the game. */
const CYCLE_MS = 6800;
const TYPE_START = 600;
const KEY_MS = 160;
const TYPED_AT = TYPE_START + CODE.length * KEY_MS;

/** A QR-looking pattern; decorative only, it encodes nothing. */
function FakeQr() {
  const size = 21;
  const isOn = (x: number, y: number) => {
    for (const [fx, fy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ] as const) {
      const dx = x - fx;
      const dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) !== 2;
    }
    return (x * 7 + y * 13 + x * y) % 5 < 2;
  };
  return (
    <div class="grid aspect-square w-full" style={{ "grid-template-columns": `repeat(${size}, 1fr)` }}>
      <For each={Array.from({ length: size * size })}>
        {(_, index) => <div class={isOn(index() % size, Math.floor(index() / size)) ? "bg-[#101024]" : ""} />}
      </For>
    </div>
  );
}

/** The game shows a code, a phone types it, a friend pops into the game, and again with the next friend. */
export default function Phone(props: { appUrl: string }) {
  const [element, setElement] = createSignal<HTMLElement>();
  const inView = useInView(element);
  // Reduced motion: hold a frame with the first guest in.
  const [time, setTime] = createSignal(3000);
  let reduced = true;
  onMount(() => (reduced = prefersReducedMotion()));
  useFrame((elapsed) => !reduced && setTime(elapsed), inView);

  const round = () => Math.floor(time() / CYCLE_MS);
  const local = () => time() % CYCLE_MS;
  const guest = () => GUESTS[round() % GUESTS.length]!;
  const typed = () => clamp(Math.floor((local() - TYPE_START) / KEY_MS), 0, CODE.length);
  const pressing = () => local() > TYPED_AT + 150 && local() < TYPED_AT + 450;
  const joined = () => local() > TYPED_AT + 900;
  const arrived = () => local() > TYPED_AT + 1200;
  const inGame = () => GUESTS.slice(0, (round() % GUESTS.length) + (arrived() ? 1 : 0));
  const toast = () => arrived() && local() < TYPED_AT + 3400;

  return (
    <section ref={setElement} id="phone" class="relative scroll-mt-16 px-5 py-14 md:py-20">
      <Glow mode="lobby" strength={0.55} />
      <div class="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1fr_1.45fr] lg:gap-24">
        <Reveal class="flex flex-col items-start gap-5">
          <h2 class="text-4xl leading-[1.05] font-bold text-balance md:text-5xl">Friends join from their phone</h2>
          <p class="text-lg text-white/70">
            Everyone signs in with their own account on their phone, then enters the code shown in the game or scans the
            QR code. Their highscores are saved to that account.
          </p>
          <Button href={`${props.appUrl}/join`} intent="gradient-lobby" class="mt-2">
            Join a lobby
          </Button>
        </Reveal>

        <div class="relative pb-20 sm:pb-16 lg:pb-0" aria-hidden="true">
          {/* the game */}
          <div class="[container-type:inline-size] relative aspect-video overflow-hidden rounded-[18px] bg-[#16162c] ring-1 shadow-crisp ring-white/10">
            <Glow mode="lobby" strength={1.4} />
            <span class="absolute top-[6cqw] left-[5cqw] text-[3.6cqw] font-bold">Tune Perfect</span>
            <div class="absolute top-[5.5cqw] right-[5cqw] flex gap-[1cqw]">
              <For each={[HOST, ...inGame()]}>
                {(player) => (
                  <span
                    class="flex size-[4.2cqw] animate-[pop_0.3s_ease-out_both] items-center justify-center rounded-full text-[1.8cqw] font-bold"
                    style={{ background: player.color }}
                  >
                    {player.name[0]}
                  </span>
                )}
              </For>
            </div>
            <div class="absolute top-[15cqw] right-[5cqw] flex items-center gap-[2cqw]">
              <div class="flex flex-col items-end gap-[0.8cqw]">
                <span class="text-[1.3cqw] font-bold tracking-[0.2em] text-white/60">JOIN LOBBY</span>
                <span class="rounded-[0.8cqw] bg-white px-[1.2cqw] py-[0.6cqw] text-[3.6cqw] font-bold tracking-wider text-[#101024]">
                  {CODE}
                </span>
                <span class="text-[1.2cqw] text-white/60">{JOIN_URL}</span>
              </div>
              <div class="w-[13cqw] rounded-[1.2cqw] bg-white p-[1.2cqw]">
                <FakeQr />
              </div>
            </div>
            <div class="absolute right-[5cqw] bottom-[9cqw] left-[5cqw] flex h-[17cqw] gap-[1.5cqw]">
              <div class="relative grow-[2] overflow-hidden rounded-[1.4cqw] bg-linear-to-b from-green-400 to-teal-600 outline-[0.3cqw] outline-white">
                <div class="absolute inset-0 stripes" />
                <span class="absolute bottom-[1.5cqw] left-[1.8cqw] text-[3cqw] font-bold">Sing</span>
              </div>
              <div class="grow rounded-[1.4cqw] bg-linear-to-b from-pink-500 to-purple-600 opacity-55" />
              <div class="grow rounded-[1.4cqw] bg-linear-to-b from-yellow-400 to-orange-500 opacity-55" />
              <div class="grow rounded-[1.4cqw] bg-linear-to-b from-cyan-400 to-blue-500 opacity-55" />
            </div>
            <Show when={toast()}>
              <div class="absolute bottom-[2.5cqw] left-1/2 flex -translate-x-1/2 animate-[rise_0.3s_ease-out_both] items-center gap-[1cqw] rounded-[1cqw] bg-black/75 px-[1.6cqw] py-[1cqw] text-[1.6cqw] font-bold whitespace-nowrap">
                <span class="size-[2.4cqw] rounded-full" style={{ background: guest().color }} />
                {guest().name} joined the lobby
              </div>
            </Show>
          </div>

          {/* the phone */}
          <div class="[container-type:inline-size] absolute -bottom-6 -left-2 w-[26%] max-w-48 sm:-left-6 lg:-bottom-16 lg:-left-12">
            <div class="rounded-[13cqw] bg-black p-[2.4cqw] shadow-[0_6px_0_rgb(0_0_0/0.35)] ring-1 ring-white/15">
              <div class="relative flex aspect-[9/19] flex-col overflow-hidden rounded-[11cqw] bg-linear-to-b from-[#2a2147] to-[#15142b] px-[7cqw] pt-[14cqw]">
                <Show
                  when={joined()}
                  fallback={
                    <>
                      <span class="text-[9cqw] leading-tight font-bold">Join a game</span>
                      <span class="mt-[1cqw] text-[4.2cqw] text-white/60">Enter the code shown in the game</span>
                      <div class="mt-[7cqw] grid grid-cols-8 gap-[1.6cqw]">
                        <Index each={CODE.split("")}>
                          {(char, index) => (
                            <span
                              class="flex aspect-[3/4] items-center justify-center rounded-[1.8cqw] text-[5.5cqw] font-bold"
                              classList={{
                                "bg-white text-[#101024]": index < typed(),
                                "bg-white/8": index >= typed(),
                                "ring-2 ring-white": index === typed(),
                              }}
                            >
                              {index < typed() ? char() : ""}
                            </span>
                          )}
                        </Index>
                      </div>
                      <span
                        class="mt-[7cqw] flex h-[13cqw] items-center justify-center rounded-[3cqw] bg-linear-to-r from-yellow-400 to-orange-500 text-[5cqw] font-bold transition-transform duration-150"
                        classList={{ "scale-95 brightness-90": pressing() }}
                      >
                        Join
                      </span>
                      <span class="mt-[5cqw] text-center text-[3.6cqw] text-white/40">or</span>
                      <span class="mt-[4cqw] flex h-[13cqw] items-center justify-center gap-[2cqw] rounded-[3cqw] bg-white/10 text-[4.6cqw] font-bold">
                        <IconQrCode /> Scan QR code
                      </span>
                    </>
                  }
                >
                  <div class="flex animate-[rise_0.35s_ease-out_both] flex-col">
                    <span class="flex items-center gap-[2cqw]">
                      <span class="text-[9cqw] font-bold">Lobby</span>
                      <span class="rounded-[1.4cqw] bg-white px-[1.6cqw] py-[0.8cqw] text-[3.4cqw] font-bold text-[#101024]">
                        {CODE}
                      </span>
                    </span>
                    <span class="mt-[1cqw] flex items-center gap-[1.5cqw] text-[4cqw] text-white/70">
                      <IconCheckCircle class="text-green-400" /> Connected to the game
                    </span>
                    <span class="mt-[7cqw] mb-[2.5cqw] text-[3.4cqw] font-bold tracking-widest text-white/45">
                      PLAYERS
                    </span>
                    <For each={[HOST, ...inGame()]}>
                      {(player) => (
                        <span class="mb-[2cqw] flex items-center gap-[3cqw] rounded-[3cqw] bg-white/7 p-[2.5cqw] text-[4.6cqw] font-bold">
                          <span class="size-[8cqw] rounded-full" style={{ background: player.color }} />
                          {player.name}
                          <Show when={player.name === guest().name}>
                            <span class="ml-auto rounded-[1.2cqw] bg-white px-[1.4cqw] py-[0.6cqw] text-[3cqw] text-[#101024]">
                              YOU
                            </span>
                          </Show>
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
                <div class="absolute inset-x-0 bottom-0 flex h-[16cqw] items-center justify-around bg-black/40 text-[6cqw] text-white/50">
                  <span class="rounded-[2.4cqw] bg-linear-to-r from-yellow-400 to-orange-500 px-[3cqw] py-[1cqw] text-white">
                    <IconMicrophone />
                  </span>
                  <IconUsersThree />
                  <IconUserCircle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
