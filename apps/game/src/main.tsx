import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { RouterProvider, createRouter } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

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

const rootElement = document.getElementById("app");
if (rootElement) {
  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    rootElement
  );
}
