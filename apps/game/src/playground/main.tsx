import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { render } from "solid-js/web";

import PopupContainer from "~/components/popup-container";
import { ToastRegion } from "~/components/ui/toast";
import GameScreen from "~/screens/game/index";
import { initializeLobbySettings } from "~/stores/lobby";
import { initializeLocalSettings } from "~/stores/local";
import { initializeSettings } from "~/stores/settings";

import PlaygroundScreen from "./playground-screen";

import "~/styles.css";

/**
 * Development playground (`bun run dev -- --playground`): starts rounds straight from a song list,
 * without lobby or API, to try the singing views with the real game loop and native side.
 */
const rootRoute = createRootRoute({
  component: () => (
    <div class="font-primary text-base text-white">
      <Suspense>
        <Outlet />
      </Suspense>
      <PopupContainer />
      <div class="pointer-events-none fixed inset-0 z-100 flex items-center justify-center">
        <div class="layout flex">
          <div class="@container relative grow overflow-hidden">
            <ToastRegion />
          </div>
        </div>
      </div>
    </div>
  ),
});

const BackHome = () => {
  const navigate = indexRoute.useNavigate();
  queueMicrotask(() => navigate({ to: "/" }));
  return null;
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: PlaygroundScreen,
  loader: () => Promise.all([initializeSettings(), initializeLocalSettings(), initializeLobbySettings()]),
});
const gameRoute = createRoute({ getParentRoute: () => rootRoute, path: "/game", component: GameScreen });
// Round ends and restarts go back to the list.
const otherRoutes = ["/game/score", "/game/next", "/game/restart"].map((path) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: BackHome }),
);

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, gameRoute, ...otherRoutes]),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

// For driving the playground over CDP, e.g. `playgroundRouter.navigate({ to: "/" })` to end a round.
Object.assign(globalThis, { playgroundRouter: router });

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const rootElement = document.getElementById("app");
if (rootElement) {
  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    rootElement,
  );
}
