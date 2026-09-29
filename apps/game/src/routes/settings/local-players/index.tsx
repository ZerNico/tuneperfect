import { createFileRoute } from "@tanstack/solid-router";

import LocalPlayersScreen from "~/screens/settings/local-players/index";

export const Route = createFileRoute("/settings/local-players/")({
  component: LocalPlayersScreen,
});
