import { createFileRoute } from "@tanstack/solid-router";

import SongsScreen from "~/screens/settings/songs/index";

export const Route = createFileRoute("/settings/songs/")({
  component: SongsScreen,
});
