import { createFileRoute } from "@tanstack/solid-router";
import IconAppleLogo from "~icons/ph/apple-logo-fill";
import IconCpu from "~icons/ph/cpu-fill";

import CodeBlock from "~/components/download/code-block";
import DownloadCard from "~/components/download/download-card";
import PlatformPage, { InfoPanel, Requirements } from "~/components/download/platform-page";
import { posthog } from "~/lib/posthog";

export const Route = createFileRoute("/download/macos")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.DOWNLOAD_VERSION?.replace(/^v/, "") || "";
  const githubRepo = () => context()?.config?.GITHUB_REPO || "";

  const handleDownload = (architecture: string, extension: string) => {
    posthog.capture("download_started", {
      download_os: "macos",
      download_version: version(),
      download_architecture: architecture,
      download_extension: extension,
    });
  };

  return (
    <PlatformPage
      icon={<IconAppleLogo />}
      title="Download for macOS"
      subtitle="Choose the version that matches your Mac"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <DownloadCard
          icon={<IconCpu />}
          title="Apple Silicon"
          subtitle="M1, M2, M3, M4 and newer"
          description="Built for Apple's own processors. Best performance and battery life."
          tags={["arm64"]}
          recommended
          extension="dmg"
          onDownload={() => handleDownload("arm64", "dmg")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_aarch64.dmg`}
        />
        <DownloadCard
          icon={<IconCpu />}
          title="Intel"
          subtitle="x86_64 processors"
          description="For older Macs with Intel processors."
          tags={["x86_64"]}
          extension="dmg"
          onDownload={() => handleDownload("x86_64", "dmg")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_x64.dmg`}
        />
      </div>

      <InfoPanel title="First launch">
        <p>The app isn't signed yet, so remove the quarantine attribute once before opening it:</p>
        <CodeBlock code={`xattr -d com.apple.quarantine "/Applications/Tune Perfect.app"`} />
      </InfoPanel>

      <InfoPanel title="Which one do I need?">
        <p>
          Open the Apple menu → About This Mac. If the chip says "Apple M1", "Apple M2" and so on, take Apple Silicon;
          if it says "Intel", take Intel.
        </p>
        <Requirements
          items={[
            "macOS 12 (Monterey) or later",
            "2 GB RAM minimum, 4 GB recommended",
            "A microphone to sing with",
            "Your own UltraStar songs",
          ]}
        />
      </InfoPanel>
    </PlatformPage>
  );
}
