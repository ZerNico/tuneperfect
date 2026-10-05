import { createFileRoute } from "@tanstack/solid-router";

import MicrophoneScreen from "~/screens/settings/microphones/$id";

export const Route = createFileRoute("/settings/microphones/$id")({
  component: MicrophoneScreen,
});
