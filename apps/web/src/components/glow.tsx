export const MODES = {
  sing: ["var(--color-green-400)", "var(--color-teal-600)"],
  party: ["var(--color-pink-500)", "var(--color-purple-600)"],
  lobby: ["var(--color-yellow-400)", "var(--color-orange-500)"],
  settings: ["var(--color-cyan-400)", "var(--color-blue-500)"],
  title: ["var(--color-sky-500)", "var(--color-purple-600)"],
} as const;

export type Mode = keyof typeof MODES;

/**
 * Two soft glows in a mode's colours behind a section, like the game's aurora background. The parent must not
 * clip (overflow-hidden), or the blur ends in a hard edge.
 */
export default function Glow(props: { mode: Mode; class?: string; strength?: number }) {
  const strength = () => props.strength ?? 1;
  return (
    <div class={`pointer-events-none absolute -z-10 ${props.class ?? "inset-0"}`} aria-hidden="true">
      <div
        class="absolute top-0 left-[5%] h-[70%] w-[55%] rounded-full blur-[90px]"
        style={{ background: MODES[props.mode][0], opacity: 0.22 * strength() }}
      />
      <div
        class="absolute right-0 bottom-0 h-[65%] w-[50%] rounded-full blur-[90px]"
        style={{ background: MODES[props.mode][1], opacity: 0.16 * strength() }}
      />
    </div>
  );
}
