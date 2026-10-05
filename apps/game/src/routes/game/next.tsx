import { createFileRoute } from "@tanstack/solid-router";

import NextScreen from "~/screens/game/next";

export const Route = createFileRoute("/game/next")({
  component: NextScreen,
});
