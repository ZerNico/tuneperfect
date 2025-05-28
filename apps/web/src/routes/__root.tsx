import { Outlet, createRootRoute } from "@tanstack/solid-router";
import Footer from "~/components/footer";
import Header from "~/components/header";
import { config } from "~/lib/config";
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

  return (
    <main class="min-h-screen bg-[#101024] font-primary text-white">
      <Header appUrl={context().config.VITE_APP_URL ?? ""} />
      <Outlet />
      <Footer />
    </main>
  );
}
