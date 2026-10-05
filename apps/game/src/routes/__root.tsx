import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, redirect } from "@tanstack/solid-router";

import { RouteError } from "~/components/route-error";
import RootScreen from "~/screens/root";

interface RouterContext {
  queryClient: QueryClient;
}

// Every app start (and full reload) begins on the home screen.
let initialized = false;

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootScreen,
  errorComponent: RouteError,
  beforeLoad: async () => {
    if (!initialized) {
      initialized = true;
      throw redirect({ to: "/" });
    }
  },
});
