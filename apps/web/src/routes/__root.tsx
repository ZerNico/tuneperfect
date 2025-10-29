import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/solid-router";
import { onMount } from "solid-js";
import { HydrationScript, isServer } from "solid-js/web";
import Footer from "~/components/footer";
import Header from "~/components/header";
import { config } from "~/lib/config";
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
          title: "Tune Perfect",
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
  notFoundComponent: () => <div>Not found</div>,
  beforeLoad: async () => {
    return {
      config: await config(),
    };
  },
});

function RootComponent() {
  const context = Route.useRouteContext();

  onMount(() => {
    const token = context().config.VITE_POSTHOG_TOKEN;

    if (isServer || !token) {
      return;
    }

    initPostHog(token);
  });

  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <div class="min-h-screen bg-[#101024] font-primary text-white">
          <Header appUrl={context().config.VITE_APP_URL ?? ""} />
          <main>
            <Outlet />
          </main>
          <Footer />
          <Scripts />
        </div>
      </body>
    </html>
  );
}
