import { createFileRoute } from "@tanstack/solid-router";

import PartyScreen from "~/screens/party/index";

export const Route = createFileRoute("/party/")({
  component: PartyScreen,
});
