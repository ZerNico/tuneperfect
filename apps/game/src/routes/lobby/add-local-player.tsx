import { createFileRoute } from "@tanstack/solid-router";

import AddLocalPlayerScreen from "~/screens/lobby/add-local-player";

export const Route = createFileRoute("/lobby/add-local-player")({
  component: AddLocalPlayerScreen,
});
