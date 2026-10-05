import { createFileRoute } from "@tanstack/solid-router";

import OnlineSearchScreen from "~/screens/sing/online";

export const Route = createFileRoute("/sing/online")({
  component: OnlineSearchScreen,
});
