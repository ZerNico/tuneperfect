import { createFileRoute } from "@tanstack/solid-router";

import RouteScreen from "~/screens/index";
import { initializeLobbySettings } from "~/stores/lobby";
import { initializeLocalSettings } from "~/stores/local";
import { initializeSettings } from "~/stores/settings";
import { initializeUsdbStore } from "~/stores/usdb";

export const Route = createFileRoute("/")({
  component: RouteScreen,
  loader: async () => {
    await Promise.all([
      initializeSettings(),
      initializeLocalSettings(),
      initializeLobbySettings(),
      initializeUsdbStore(),
    ]);
  },
});
