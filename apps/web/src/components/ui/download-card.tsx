import type { JSX } from "solid-js";
import { For } from "solid-js";
import Button from "~/components/ui/button";

interface Tag {
  text: string;
  color?: "blue" | "green" | "red" | "orange" | "purple" | "slate";
}

interface DownloadCardProps {
  icon: JSX.Element;
  gradientFrom: string;
  gradientTo: string;
  title: string;
  subtitle: string;
  description: string;
  tags: Tag[];
  extension: string;
  url: string;
}

export default function DownloadCard(props: DownloadCardProps) {
  const getTagColor = (color: Tag["color"] = "slate") => {
    switch (color) {
      case "blue":
        return "bg-blue-500/20 text-blue-300";
      case "green":
        return "bg-green-500/20 text-green-300";
      case "red":
        return "bg-red-500/20 text-red-300";
      case "orange":
        return "bg-orange-500/20 text-orange-300";
      case "purple":
        return "bg-purple-500/20 text-purple-300";
      default:
        return "bg-slate-600 text-slate-300";
    }
  };

  return (
    <div class="group flex flex-col gap-6 rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-slate-750 hover:shadow-2xl">
      <div class="flex items-center gap-4">
        <div
          class="rounded-full p-3"
          style={{
            background: `linear-gradient(to right, ${props.gradientFrom}, ${props.gradientTo})`,
          }}
        >
          {props.icon}
        </div>
        <div>
          <h3 class="font-bold text-slate-100 text-xl">{props.title}</h3>
          <p class="text-slate-400 text-sm">{props.subtitle}</p>
        </div>
      </div>

      <div class="space-y-3">
        <p class="text-slate-300 text-sm">{props.description}</p>
        <div class="flex flex-wrap gap-2">
          <For each={props.tags}>{(tag) => <span class={`rounded-full px-3 py-1 text-xs ${getTagColor(tag.color)}`}>{tag.text}</span>}</For>
        </div>
      </div>

      <div class="mt-auto">
        <Button href={props.url}  intent="gradient-settings">
          Download (.{props.extension})
        </Button>
      </div>
    </div>
  );
}
