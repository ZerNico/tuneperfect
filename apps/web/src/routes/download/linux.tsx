import { createFileRoute } from "@tanstack/solid-router";
import IconLinuxLogo from "~icons/ph/linux-logo-fill";
import IconPackage from "~icons/ph/package-fill";

import CodeBlock from "~/components/download/code-block";
import DownloadCard from "~/components/download/download-card";
import PlatformPage, { InfoPanel, Requirements } from "~/components/download/platform-page";
import { posthog } from "~/lib/posthog";

export const Route = createFileRoute("/download/linux")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.DOWNLOAD_VERSION?.replace(/^v/, "") || "";
  const githubRepo = () => context()?.config?.GITHUB_REPO || "";

  const handleDownload = (architecture: string, extension: string) => {
    posthog.capture("download_started", {
      download_os: "linux",
      download_version: version(),
      download_architecture: architecture,
      download_extension: extension,
    });
  };

  return (
    <PlatformPage
      icon={<IconLinuxLogo />}
      title="Download for Linux"
      subtitle="Pick your distribution, or the AppImage that runs anywhere"
    >
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DownloadCard
          class="md:col-span-2 lg:col-span-1"
          icon={<IconPackage />}
          title="AppImage"
          subtitle="Any distribution"
          description="Download, make it executable, run. Nothing to install."
          tags={["amd64"]}
          recommended
          extension="AppImage"
          onDownload={() => handleDownload("amd64", "AppImage")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_amd64.AppImage`}
        />
        <DownloadCard
          icon={<IconPackage />}
          title="Debian / Ubuntu"
          subtitle=".deb package"
          description="For Debian, Ubuntu, Linux Mint, Pop!_OS and other Debian-based distributions."
          tags={["amd64"]}
          extension="deb"
          onDownload={() => handleDownload("amd64", "deb")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_amd64.deb`}
        />
        <DownloadCard
          icon={<IconPackage />}
          title="Fedora / RHEL"
          subtitle=".rpm package"
          description="For Fedora, RHEL, openSUSE and other RPM-based distributions."
          tags={["x86_64"]}
          extension="rpm"
          onDownload={() => handleDownload("x86_64", "rpm")}
          url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect-${version()}-1.x86_64.rpm`}
        />
      </div>

      <InfoPanel title="Installing">
        <CodeBlock
          label="AppImage"
          code={`chmod +x Tune.Perfect_${version()}_amd64.AppImage\n./Tune.Perfect_${version()}_amd64.AppImage`}
        />
        <CodeBlock label="Debian / Ubuntu" code={`sudo apt install ./Tune.Perfect_${version()}_amd64.deb`} />
        <CodeBlock label="Fedora / RHEL" code={`sudo dnf install ./Tune.Perfect-${version()}-1.x86_64.rpm`} />
      </InfoPanel>

      <InfoPanel title="System requirements">
        <Requirements
          items={["2 GB RAM minimum, 4 GB recommended", "A microphone to sing with", "Your own UltraStar songs"]}
        />
      </InfoPanel>
    </PlatformPage>
  );
}
