import { createMemo, For, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { isGolden, isRap, type Note } from "~/lib/ultrastar/note";

function SparkleParticles(props: { length: number }) {
  // Scale particles based on note length: base 4 particles + 2 per beat, capped at 16
  const particleCount = createMemo(() => Math.min(4 + Math.floor(props.length * 2), 16));

  // Generate random particles with different delays and positions
  // oxlint-disable-next-line solid/reactivity
  const particles = Array.from({ length: particleCount() }, (_, i) => ({
    id: i,
    delay: Math.random() * 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 0.3 + 0.2, // 0.2 to 0.5
    duration: Math.random() * 1.5 + 1.5, // 1.5 to 3 seconds
  }));

  return (
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <For each={particles}>
        {(particle) => (
          <div
            class="absolute animate-sparkle rounded-full bg-yellow-300 opacity-0"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}cqw`,
              height: `${particle.size}cqw`,
              "animation-delay": `${particle.delay}s`,
              "animation-duration": `${particle.duration}s`,
              "box-shadow": "0 0 0.2cqw rgba(251, 191, 36, 0.8)",
            }}
          />
        )}
      </For>
    </div>
  );
}

/**
 * A note's bar, filling the box it's placed in: both singing views draw their notes with it, so
 * they look the same. Golden notes sparkle, rap notes are dashed.
 */
export default function NoteBar(props: { note: Note }) {
  const golden = () => isGolden(props.note);

  return (
    // One outline, no shadow (a blurred one turns into a grey haze on light videos).
    <div
      class="relative h-full w-full overflow-hidden rounded-full border-[0.22cqw] transition-opacity duration-300"
      classList={{
        "border-yellow-300 bg-yellow-300/25": golden(),
        "border-white bg-black/35": !golden(),
        "border-dashed": isRap(props.note),
      }}
    >
      <Show when={golden() && effectsEnabled()}>
        <SparkleParticles length={props.note.length} />
      </Show>
    </div>
  );
}
