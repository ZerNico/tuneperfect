import { createFileRoute } from "@tanstack/solid-router";

import IndexScreen from "~/screens/create-lobby";

export const Route = createFileRoute("/create-lobby")({
  component: IndexScreen,
});
