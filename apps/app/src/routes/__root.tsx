import type { QueryClient } from "@tanstack/solid-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import Header from "~/components/header";
import { ToastRegion } from "~/components/ui/toast";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  beforeLoad: async ({ context }) => {
    //await context.queryClient.prefetchQuery(sessionQueryOptions());
  },
});

function RootComponent() {
  return (
    <>
      <div class="gradient-bg-secondary flex min-h-[100dvh] flex-col font-primary text-white">
        <Header />
        <Outlet />
        <TanStackRouterDevtools />
        <ToastRegion />
      </div>
    </>
  );
}
