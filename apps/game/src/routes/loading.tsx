import { createFileRoute } from "@tanstack/solid-router";
import * as v from "valibot";

import LoadingScreen from "~/screens/loading";

export const Route = createFileRoute("/loading")({
  component: LoadingScreen,
  validateSearch: v.object({
    redirect: v.string(),
  }),
});
