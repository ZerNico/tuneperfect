;
import DownloadCard from "~/components/download-card";
import { posthog } from "~/lib/posthog";
import IconChip from "~icons/lucide/cpu";
import IconApple from "~icons/sing/apple";

export const Route = createFileRoute({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.VERSION?.replace(/^v/, '') || '';
  const githubRepo = () => context()?.config?.GITHUB_REPO || '';

  const handleDownload = (architecture: string, extension: string) => {
    posthog.capture("download_started", {
      download_os: "macos",
      download_version: version(),
      download_architecture: architecture,
      download_extension: extension,
    });
  };

  return (
    <div class="relative flex flex-col gap-y-16 bg-slate-900 px-4 pt-20 pb-20 text-white">
      <section class="relative z-2 mx-auto w-full max-w-4xl">
        <div class="mb-6 flex items-center gap-4">
          <IconApple class="h-12 w-12 text-white" />
          <div>
            <h1 class="font-bold text-4xl">Download for macOS</h1>
            <p class="text-slate-400">Choose the version that matches your Mac</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
          <DownloadCard
            icon={<IconChip class="h-6 w-6 text-white" />}
            gradientFrom="#3b82f6"
            gradientTo="#8b5cf6"
            title="Apple Silicon"
            subtitle="M1, M2, M3, M4 chips"
            description="Optimized for Apple's latest processors. Best performance and battery life."
            tags={[
              { text: "Recommended", color: "blue" },
              { text: "arm64", color: "slate" },
            ]}
            extension="dmg"
            platform="macos"
            onDownload={() => handleDownload("arm64", "dmg")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_aarch64.dmg`}
          />

          <DownloadCard
            icon={<IconChip class="h-6 w-6 text-white" />}
            gradientFrom="#6b7280"
            gradientTo="#374151"
            title="Intel"
            subtitle="x86_64 processors"
            description="For older Macs with Intel processors. Compatible with all Intel-based Macs."
            tags={[{ text: "x86_64", color: "slate" }]}
            extension="dmg"
            platform="macos"
            onDownload={() => handleDownload("x86_64", "dmg")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_x64.dmg`}
          />
        </div>

        <div class="mt-12 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h3 class="mb-3 font-semibold text-slate-200">Not sure which version to choose?</h3>
          <p class="mb-4 text-slate-300 text-sm">
            Check your Mac's processor by clicking the Apple menu → About This Mac. If you see "Apple M1", "Apple M2", etc., choose Apple
            Silicon. If you see "Intel", choose the Intel version.
          </p>
          <div class="space-y-2 text-slate-400 text-xs">
            <p>
              <strong>System Requirements:</strong>
            </p>
            <ul class="ml-4 list-disc space-y-1">
              <li>macOS 12.0 (Monterey) or later</li>
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
