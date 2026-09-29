import { createFileRoute } from "@tanstack/solid-router";

import PlayerSelectionScreen from "~/screens/sing/select";

export const Route = createFileRoute("/sing/select")({
  component: PlayerSelectionScreen,
});
