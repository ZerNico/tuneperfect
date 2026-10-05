import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/solid-router";
import { onMount } from "solid-js";
import { HydrationScript, isServer } from "solid-js/web";

import Footer from "~/components/footer";
import Header from "~/components/header";
import NotFound from "~/components/not-found";
import { config, githubUrl } from "~/lib/config";
import { initPostHog } from "~/lib/posthog";

import styles from "../styles.css?url";

export const Route = createRootRoute({
  head: () => {
    return {
      meta: [
        {
          charset: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Tune Perfect · The karaoke game",
        },
        {
          name: "description",
          content:
            "A karaoke game for macOS, Windows and Linux. Sing your own UltraStar songs with up to four microphones, play party modes and let friends join from their phone.",
        },
        {
          name: "theme-color",
          content: "#101024",
        },
      ],
      links: [
        {
          rel: "stylesheet",
          href: styles,
        },
        {
          rel: "icon",
          href: "/favicon.svg",
          type: "image/svg+xml",
        },
        {
          rel: "icon",
          href: "/favicon.ico",
          type: "image/x-icon",
        },
      ],
    };
  },
  component: RootComponent,
  notFoundComponent: NotFound,
  beforeLoad: async () => {
    return {
      config: await config(),
    };
  },
});

function RootComponent() {
  const context = Route.useRouteContext();

  const appUrl = () => context().config.VITE_APP_URL ?? "";
  const github = () => githubUrl(context().config.GITHUB_REPO);

  onMount(() => {
    const token = context().config.VITE_POSTHOG_TOKEN;

    if (isServer || !token) {
      return;
    }

    initPostHog(token);
  });

  return (
    <html lang="en">
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        {/* overflow-x-clip (not hidden): sections' glows spill sideways without making the page scroll */}
        <div class="relative isolate flex min-h-screen flex-col overflow-x-clip">
          <Header appUrl={appUrl()} githubUrl={github()} />
          <main class="grow">
            <Outlet />
          </main>
          <Footer appUrl={appUrl()} githubUrl={github()} />
          <Scripts />
        </div>
      </body>
    </html>
  );
}
