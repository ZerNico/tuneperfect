import { createFileRoute } from "@tanstack/solid-router";

import GeneralSettingsScreen from "~/screens/settings/general/index";

export const Route = createFileRoute("/settings/general/")({
  component: GeneralSettingsScreen,
});
