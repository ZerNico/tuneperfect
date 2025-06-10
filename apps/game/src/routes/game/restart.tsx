import { createFileRoute, Navigate } from "@tanstack/solid-router";

export const Route = createFileRoute("/game/restart")({
  component: RestartComponent,
});

function RestartComponent() {
  return <Navigate to="/game" replace />;
}
