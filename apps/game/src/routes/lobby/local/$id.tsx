import { createFileRoute } from "@tanstack/solid-router";

import LobbyLocalPlayerScreen from "~/screens/lobby/local/$id";

export const Route = createFileRoute("/lobby/local/$id")({
  component: LobbyLocalPlayerScreen,
});
