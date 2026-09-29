import { createFileRoute } from "@tanstack/solid-router";

import HomeScreen from "~/screens/home";

export const Route = createFileRoute("/home")({
  component: HomeScreen,
});
