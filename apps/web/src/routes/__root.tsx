import { Outlet, createRootRoute } from "@tanstack/solid-router";

import "../styles.css";
import "@fontsource/lato/300.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import Header from "~/components/header";

export const Route = createRootRoute({
  head: () => ({
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
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <main class="min-h-screen bg-[#101024] font-primary text-white">
      <Header />
      <Outlet />
    </main>
  );
}
