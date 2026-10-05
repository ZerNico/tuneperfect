import { createFileRoute } from "@tanstack/solid-router";

import Download from "~/components/home/download";
import Features from "~/components/home/features";
import Hero from "~/components/home/hero";
import Phone from "~/components/home/phone";
import { githubUrl } from "~/lib/config";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const context = Route.useRouteContext();
  const config = () => context().config;
  const github = () => githubUrl(config().GITHUB_REPO);

  return (
    <>
      <Hero githubUrl={github()} />
      <Features />
      <Phone appUrl={config().VITE_APP_URL ?? ""} />
      <Download version={config().DOWNLOAD_VERSION?.replace(/^v/, "")} githubUrl={github()} />
    </>
  );
}
