import { createFileRoute } from "@tanstack/solid-router";

import CreditsScreen from "~/screens/settings/credits";

export const Route = createFileRoute("/settings/credits")({
  component: CreditsScreen,
});
