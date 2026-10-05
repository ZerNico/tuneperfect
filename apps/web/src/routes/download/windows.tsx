import { createFileRoute } from "@tanstack/solid-router";
import IconCpu from "~icons/ph/cpu-fill";
import IconWindowsLogo from "~icons/ph/windows-logo-fill";

import DownloadCard from "~/components/download/download-card";
import PlatformPage, { InfoPanel, Requirements } from "~/components/download/platform-page";
import { posthog } from "~/lib/posthog";

export const Route = createFileRoute("/download/windows")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.DOWNLOAD_VERSION?.replace(/^v/, "") || "";
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
    <PlatformPage
      icon={<IconWindowsLogo />}
      title="Download for Windows"
      subtitle="Choose the version that matches your PC"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <DownloadCard
          icon={<IconCpu />}
          title="64-bit"
          subtitle="Intel & AMD processors"
          description="For almost every Windows PC. Take this one if you're not sure."
          tags={["x64"]}
          recommended
          extension="exe"
          onDownload={() => handleDownload("x64", "exe")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_x64-setup.exe`}
        />
        <DownloadCard
          icon={<IconCpu />}
          title="ARM64"
          subtitle="ARM processors"
          description="For Windows PCs with ARM processors, like Snapdragon laptops or the Surface Pro X."
          tags={["arm64"]}
          extension="exe"
          onDownload={() => handleDownload("arm64", "exe")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_arm64-setup.exe`}
        />
      </div>

      <InfoPanel title="Which one do I need?">
        <p>Go to Settings → System → About and look at "System type". Most PCs say x64.</p>
        <Requirements
          items={[
            "Windows 10 or later",
            "2 GB RAM minimum, 4 GB recommended",
            "A microphone to sing with",
            "Your own UltraStar songs",
          ]}
        />
      </InfoPanel>
    </PlatformPage>
  );
}
