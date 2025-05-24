import type { JSX } from "solid-js";
import { getColorVar } from "~/lib/utils/color";

interface FeatureCardProps {
  icon: JSX.Element;
  color: string;
  title: string;
  description: string;
}

export default function FeatureCard(props: FeatureCardProps) {
  const colorFrom = getColorVar(props.color, 400);
  const colorTo = getColorVar(props.color, 600);

  return (
    <div class="group flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800 p-7 shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-slate-700 hover:shadow-2xl">
      <div
        class="mb-2 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 ease-in-out"
        style={{
          background: `linear-gradient(to right, ${colorFrom}, ${colorTo})`,
        }}
      >
        <div class="text-3xl text-white">
          {props.icon}
        </div>
      </div>
      <h3 class="font-semibold text-slate-100 text-xl tracking-tight">{props.title}</h3>
      <p class="text-balance text-center text-slate-300 text-sm">
        {props.description}
      </p>
    </div>
  );
} 