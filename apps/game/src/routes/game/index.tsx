import { createFileRoute } from "@tanstack/solid-router";

import GameScreen from "~/screens/game/index";

export const Route = createFileRoute("/game/")({
  component: GameScreen,
});
