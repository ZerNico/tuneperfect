import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, redirect } from "@tanstack/solid-router";
import { createSignal } from "solid-js";

import { RouteError } from "~/components/route-error";
import RootScreen from "~/screens/root";

interface RouterContext {
  queryClient: QueryClient;
}

const [initialized, setInitialized] = createSignal(false);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootScreen,
  errorComponent: RouteError,
  beforeLoad: async () => {
    if (!initialized()) {
      setInitialized(true);
      throw redirect({ to: "/" });
    }
  },
});
