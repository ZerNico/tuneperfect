import { createFileRoute } from "@tanstack/solid-router";

import UsdbSettingsScreen from "~/screens/settings/usdb";

export const Route = createFileRoute("/settings/usdb")({
  component: UsdbSettingsScreen,
});
