import { createFileRoute } from "@tanstack/solid-router";

import SongsScreen from "~/screens/settings/songs/$path";

export const Route = createFileRoute("/settings/songs/$path")({
  component: SongsScreen,
});
