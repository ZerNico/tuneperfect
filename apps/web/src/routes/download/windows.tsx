import { createFileRoute } from "@tanstack/solid-router";
import DownloadCard from "~/components/download-card";
import IconMonitor from "~icons/lucide/monitor";
import IconWindows from "~icons/sing/windows";

export const Route = createFileRoute("/download/windows")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.VERSION?.replace(/^v/, "") || "";

  return (
    <div class="relative flex flex-col gap-y-16 bg-slate-900 px-4 pt-20 pb-20 text-white">
      <section class="relative z-2 mx-auto w-full max-w-4xl">
        <div class="mb-6 flex items-center gap-4">
          <IconWindows class="h-12 w-12 text-white" />
          <div>
            <h1 class="font-bold text-4xl">Download for Windows</h1>
            <p class="text-slate-400">Choose your system architecture</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8">
          <DownloadCard
            icon={<IconMonitor class="h-6 w-6 text-white" />}
            gradientFrom="#3b82f6"
            gradientTo="#1d4ed8"
            title="Windows 64-bit"
            subtitle="For most Windows PCs"
            description="Standard installer for Windows on Intel and AMD processors. Works on most Windows computers."
            tags={[
              { text: "Recommended", color: "blue" },
              { text: "x86_64", color: "slate" },
            ]}
            extension="exe"
            url={`https://github.com/ZerNico/tuneperfect/releases/download/v${version()}/Tune.Perfect_${version()}_x64-setup.exe`}
          />
        </div>

        <div class="mt-12 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 class="mb-3 font-semibold text-slate-200">Not sure which version to choose?</h3>
          <p class="mb-4 text-slate-300 text-sm">
            Most Windows computers use x86_64 architecture. Choose ARM64 only if you have a Windows on ARM device like Surface Pro X, Galaxy
            Book Go, or other ARM-based Windows computers.
          </p>
          <div class="space-y-2 text-slate-400 text-xs">
            <p>
              <strong>System Requirements:</strong>
            </p>
            <ul class="ml-4 list-disc space-y-1">
              <li>Windows 7 or later</li>
              <li>2 GB RAM minimum, 4 GB recommended</li>
              <li>Audio input device (microphone) required for gameplay</li>
              <li>Your own UltraStar compatible songs</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
