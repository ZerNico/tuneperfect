import { createFileRoute } from "@tanstack/solid-router";

import LocalPlayerScreen from "~/screens/settings/local-players/$id";

export const Route = createFileRoute("/settings/local-players/$id")({
  component: LocalPlayerScreen,
});
