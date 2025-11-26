import { createFileRoute, Navigate } from "@tanstack/solid-router";
import { roundStore } from "~/stores/round";

export const Route = createFileRoute("/game/next")({
  component: NextComponent,
});

function NextComponent() {
  // Advance the queue by removing the first song
  roundStore.setSettings((prev) => {
    if (!prev) return undefined;
    return {
      ...prev,
      songs: prev.songs.slice(1),
    };
  });

  return <Navigate to="/game/restart" replace />;
}

