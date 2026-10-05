import type { JSX } from "solid-js";

import Glow, { type Mode } from "~/components/glow";

import PartyScreen from "./party-screen";
import Reveal from "./reveal";
import Screen, { SHOTS } from "./screen";
import SingScreen from "./sing-screen";

interface RowProps {
  id?: string;
  mode: Mode;
  title: string;
  children: JSX.Element;
  media: JSX.Element;
  flip?: boolean;
}

/** A visual on one side, a tag, short headline and a sentence or two on the other. */
function Row(props: RowProps) {
  return (
    <section id={props.id} class="relative scroll-mt-16 px-5 py-14 md:py-20">
      <Glow mode={props.mode} strength={0.55} />
      <div
        class={`mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:gap-16 ${props.flip ? "lg:grid-cols-[1fr_1.45fr]" : "lg:grid-cols-[1.45fr_1fr]"}`}
      >
        <Reveal class={props.flip ? "lg:order-2" : undefined}>{props.media}</Reveal>
        <Reveal delay={100} class={`flex flex-col items-start gap-5 ${props.flip ? "lg:order-1" : ""}`}>
          <h2 class="text-4xl leading-[1.05] font-bold text-balance md:text-5xl">{props.title}</h2>
          <p class="text-lg text-white/70">{props.children}</p>
        </Reveal>
      </div>
    </section>
  );
}

export default function Features() {
  return (
    <>
      <Row
        id="sing"
        mode="title"
        title="Hit the notes"
        media={
          <Screen>
            <SingScreen />
          </Screen>
        }
      >
        The game follows your voice note by note while you sing. Bring more microphones and everyone gets their own
        lane.
      </Row>

      <Row
        mode="settings"
        title="Bring your own songs"
        media={<Screen src={SHOTS.select} alt="The song browser in Tune Perfect" />}
        flip
      >
        It reads the UltraStar songs you already have. Add a folder and start singing.
      </Row>

      <Row id="party" mode="party" title="Party modes" media={<PartyScreen />}>
        Go one on one in Versus, or split into two teams and fight over the board in Tic Tac Toe.
      </Row>
    </>
  );
}
