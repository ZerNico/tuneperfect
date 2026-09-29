import { createFileRoute } from "@tanstack/solid-router";

import SingScreen from "~/screens/sing/index";

export const Route = createFileRoute("/sing/")({
  component: SingScreen,
});
