import { createFileRoute } from "@tanstack/solid-router";

import VolumeScreen from "~/screens/settings/volume/index";

export const Route = createFileRoute("/settings/volume/")({
  component: VolumeScreen,
});
