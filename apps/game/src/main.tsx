import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";

import { native } from "./lib/native/client";
import { initPostHog } from "./lib/posthog";
import { forwardConsole } from "./lib/utils/console";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

forwardConsole("warn", (message) => native.app.log({ level: "warn", message }));
forwardConsole("error", (message) => native.app.log({ level: "error", message }));

const posthogToken = import.meta.env.VITE_POSTHOG_TOKEN;
if (posthogToken) void initPostHog(posthogToken);

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
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
  defaultViewTransition: true,
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
