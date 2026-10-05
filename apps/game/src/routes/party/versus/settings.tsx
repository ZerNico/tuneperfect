import { createFileRoute } from "@tanstack/solid-router";

import { lobbyQueryOptions } from "~/lib/queries";
import VersusSettingsScreen from "~/screens/party/versus/settings";

export const Route = createFileRoute("/party/versus/settings")({
  component: VersusSettingsScreen,
  beforeLoad: async ({ context }) => {
    context.queryClient.prefetchQuery(lobbyQueryOptions());
  },
});
