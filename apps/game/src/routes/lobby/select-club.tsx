import { createFileRoute } from "@tanstack/solid-router";

import SelectClubScreen from "~/screens/lobby/select-club";

export const Route = createFileRoute("/lobby/select-club")({
  component: SelectClubScreen,
});
