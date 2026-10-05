import { createFileRoute } from "@tanstack/solid-router";

import LobbyScreen from "~/screens/lobby/index";

export const Route = createFileRoute("/lobby/")({
  component: LobbyScreen,
});
