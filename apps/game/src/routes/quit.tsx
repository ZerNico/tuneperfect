import { createFileRoute } from "@tanstack/solid-router";

import QuitScreen from "~/screens/quit";

export const Route = createFileRoute("/quit")({
  component: QuitScreen,
});
