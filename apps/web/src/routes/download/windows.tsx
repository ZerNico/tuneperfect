import { createFileRoute } from "@tanstack/solid-router"
import DownloadCard from "~/components/download-card";
import { posthog } from "~/lib/posthog";
import IconChip from "~icons/lucide/cpu";
import IconWindows from "~icons/sing/windows";

export const Route = createFileRoute("/download/windows")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.VERSION?.replace(/^v/, "") || "";
  const githubRepo = () => context()?.config?.GITHUB_REPO || "";

  const handleDownload = (architecture: string, extension: string) => {
    posthog.capture("download_started", {
      download_os: "windows",
      download_version: version(),
      download_architecture: architecture,
      download_extension: extension,
    });
  };

  return (
    <div class="relative flex flex-col gap-y-16 bg-slate-900 px-4 pt-20 pb-20 text-white">
      <section class="relative z-2 mx-auto w-full max-w-4xl">
        <div class="mb-6 flex items-center gap-4">
          <IconWindows class="h-12 w-12 text-white" />
          <div>
            <h1 class="font-bold text-4xl">Download for Windows</h1>
            <p class="text-slate-400">Choose the version that matches your PC</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
          <DownloadCard
            icon={<IconChip class="h-6 w-6 text-white" />}
            gradientFrom="#3b82f6"
            gradientTo="#8b5cf6"
            title="64-bit"
            subtitle="x64 processors"
            description="For modern Windows PCs with Intel/AMD processors. Recommended for most users."
            tags={[
              { text: "Recommended", color: "blue" },
              { text: "x64", color: "slate" },
            ]}
            extension="exe"
            platform="windows"
            onDownload={() => handleDownload("x64", "exe")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_x64-setup.exe`}
          />

          <DownloadCard
            icon={<IconChip class="h-6 w-6 text-white" />}
            gradientFrom="#6b7280"
            gradientTo="#374151"
            title="ARM64"
            subtitle="ARM processors"
            description="For Windows PCs with ARM processors (like Surface Pro X)."
            tags={[{ text: "ARM64", color: "slate" }]}
            extension="exe"
            platform="windows"
            onDownload={() => handleDownload("arm64", "exe")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_arm64-setup.exe`}
          />
        </div>

        <div class="mt-12 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 class="mb-3 font-semibold text-slate-200">Not sure which version to choose?</h3>
          <p class="mb-4 text-slate-300 text-sm">
            Most modern Windows PCs use 64-bit Windows. If you're not sure, you can check by going to Settings → System
            → About and looking at the "System type" field.
          </p>
          <div class="space-y-2 text-slate-400 text-xs">
            <p>
              <strong>System Requirements:</strong>
            </p>
            <ul class="ml-4 list-disc space-y-1">
              <li>Windows 10 or later</li>
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
