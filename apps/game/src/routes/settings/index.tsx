import { createFileRoute } from "@tanstack/solid-router";

import { native } from "~/lib/native/client";
import { tryCatch } from "~/lib/utils/try-catch";
import SettingsScreen from "~/screens/settings/index";

export const Route = createFileRoute("/settings/")({
  component: SettingsScreen,
  loader: async () => {
    const [_error, songpaths] = await tryCatch(native.app.songPaths());
    return {
      songpaths: songpaths ?? [],
    };
  },
});
