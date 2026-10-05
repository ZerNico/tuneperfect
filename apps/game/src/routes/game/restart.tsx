import { createFileRoute } from "@tanstack/solid-router";

import RestartScreen from "~/screens/game/restart";

export const Route = createFileRoute("/game/restart")({
  component: RestartScreen,
});
