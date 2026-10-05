import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";

import { RouteError } from "./components/route-error";
import { native } from "./lib/native/client";
import { initPostHog } from "./lib/posthog";
import { forwardConsole } from "./lib/utils/console";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

forwardConsole("warn", (message) => native.app.log({ level: "warn", message }));
forwardConsole("error", (message) => native.app.log({ level: "error", message }));

const posthogToken = import.meta.env.VITE_POSTHOG_TOKEN;
if (posthogToken) void initPostHog(posthogToken);

const WIPE_ROUTES = new Set(["/game", "/game/", "/game/score"]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  scrollRestoration: true,
  // Every route gets the error screen, so a screen that throws doesn't take the root (lobby
  // connections, toasts, popups) down with it.
  defaultErrorComponent: RouteError,
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
  defaultViewTransition: {
    // Big moments (starting a song, its results) wipe in; everything else fades.
    types: ({ toLocation }) => (WIPE_ROUTES.has(toLocation.pathname) ? ["wipe"] : ["fade"]),
  },
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

declare global {
  var appRootDispose: (() => void) | undefined;
}

globalThis.appRootDispose?.();

const rootElement = document.getElementById("app");
if (rootElement) {
  globalThis.appRootDispose = render(
    () => (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    rootElement,
  );
}
