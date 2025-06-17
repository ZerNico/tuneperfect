import { createFileRoute } from "@tanstack/solid-router"
import DownloadCard from "~/components/download-card";
import { posthog } from "~/lib/posthog";
import IconPackage from "~icons/lucide/package";
import IconLinux from "~icons/sing/linux";

export const Route = createFileRoute("/download/linux")({
  component: RouteComponent,
});

function RouteComponent() {
  const context = Route.useRouteContext();
  const version = () => context()?.config?.VERSION?.replace(/^v/, "") || "";
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
    <div class="relative flex flex-col gap-y-16 bg-slate-900 px-4 pt-20 pb-20 text-white">
      <section class="relative z-2 mx-auto w-full max-w-5xl">
        <div class="mb-6 flex items-center gap-4">
          <IconLinux class="h-12 w-12 text-white brightness-1000" />
          <div>
            <h1 class="font-bold text-4xl">Download for Linux</h1>
            <p class="text-slate-400">Choose your distribution or use the universal AppImage</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <DownloadCard
            class="md:col-span-2 lg:col-span-1"
            icon={<IconPackage class="h-6 w-6 text-white" />}
            gradientFrom="#22c55e"
            gradientTo="#16a34a"
            title="AppImage"
            subtitle="Universal Linux package"
            description="Works on any Linux distribution. Just download, make executable, and run."
            tags={[
              { text: "Recommended", color: "green" },
              { text: "amd64", color: "slate" },
            ]}
            extension="AppImage"
            platform="linux"
            onDownload={() => handleDownload("amd64", "AppImage")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_amd64.AppImage`}
          />

          <DownloadCard
            icon={<IconPackage class="h-6 w-6 text-white" />}
            gradientFrom="#f97316"
            gradientTo="#dc2626"
            title="Debian/Ubuntu"
            subtitle=".deb package"
            description="For Debian, Ubuntu, Linux Mint, Pop!_OS, and other Debian-based distributions."
            tags={[
              { text: "amd64", color: "slate" },
              { text: ".deb", color: "orange" },
            ]}
            extension="deb"
            platform="linux"
            onDownload={() => handleDownload("amd64", "deb")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect_${version()}_amd64.deb`}
          />

          <DownloadCard
            icon={<IconPackage class="h-6 w-6 text-white" />}
            gradientFrom="#ef4444"
            gradientTo="#dc2626"
            title="Red Hat/Fedora"
            subtitle=".rpm package"
            description="For RHEL, Fedora, CentOS, openSUSE, and other RPM-based distributions."
            tags={[
              { text: "x86_64", color: "slate" },
              { text: ".rpm", color: "red" },
            ]}
            extension="rpm"
            platform="linux"
            onDownload={() => handleDownload("x86_64", "rpm")}
            url={`https://github.com/${githubRepo()}/releases/download/v${version()}/Tune.Perfect-${version()}-1.x86_64.rpm`}
          />
        </div>

        <div class="mt-12 space-y-6">
          <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <h3 class="mb-4 font-semibold text-slate-200">Installation Instructions</h3>

            <div class="space-y-4">
              <div>
                <h4 class="mb-2 font-medium text-slate-300 text-sm">AppImage:</h4>
                <code class="block rounded bg-slate-900 p-2 text-slate-300 text-xs">
                  chmod +x Tune.Perfect_{version()}_amd64.AppImage
                  <br />
                  ./Tune.Perfect_{version()}_amd64.AppImage
                </code>
              </div>

              <div>
                <h4 class="mb-2 font-medium text-slate-300 text-sm">Debian/Ubuntu (.deb):</h4>
                <code class="block rounded bg-slate-900 p-2 text-slate-300 text-xs">
                  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-0 libgtk-3-0
                  <br />
                  sudo dpkg -i Tune.Perfect_{version()}_amd64.deb
                  <br />
                  sudo apt-get install -f # If dependencies are missing
                </code>
              </div>

              <div>
                <h4 class="mb-2 font-medium text-slate-300 text-sm">Red Hat/Fedora (.rpm):</h4>
                <code class="block rounded bg-slate-900 p-2 text-slate-300 text-xs">
                  sudo dnf install libwebkit2gtk-4.1-0 libgtk-3-0
                  <br />
                  sudo dnf install Tune.Perfect-{version()}-1.x86_64.rpm
                </code>
              </div>
            </div>
          </div>

          {/* System Requirements */}
          <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <h3 class="mb-3 font-semibold text-slate-200">System Requirements</h3>
            <div class="space-y-2 text-slate-400 text-xs">
              <ul class="ml-4 list-disc space-y-1">
                <li>2 GB RAM minimum, 4 GB recommended</li>
                <li>Audio input device (microphone) required for gameplay</li>
                <li>Your own UltraStar compatible songs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
