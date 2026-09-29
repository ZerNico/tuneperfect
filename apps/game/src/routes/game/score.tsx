import { createFileRoute } from "@tanstack/solid-router";

import ScoreScreen from "~/screens/game/score";

export const Route = createFileRoute("/game/score")({
  component: ScoreScreen,
});
