import { createFileRoute } from "@tanstack/solid-router";

import OnlineLoadingScreen from "~/screens/sing/online-loading";

export const Route = createFileRoute("/sing/online-loading")({
  component: OnlineLoadingScreen,
});
