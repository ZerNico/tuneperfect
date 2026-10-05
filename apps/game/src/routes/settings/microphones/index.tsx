import { createFileRoute } from "@tanstack/solid-router";

import MicrophonesScreen from "~/screens/settings/microphones/index";

export const Route = createFileRoute("/settings/microphones/")({
  component: MicrophonesScreen,
});
