import { safe } from "@orpc/client";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { onMount } from "solid-js";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { queryClient } from "~/main";

export const Route = createFileRoute("/_auth/_no-lobby/join/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const navigate = useNavigate();

  const join = async () => {
    const [error, _data, isDefined] = await safe(client.lobby.joinLobby.call({ lobbyId: params().id }));

    if (error) {
      if (isDefined && error.code === "NOT_FOUND") {
        notify({
          message: t("join.lobby_not_found"),
          intent: "error",
        });

        navigate({ to: "/join" });
        return;
      }

      notify({
        message: t("error.unknown"),
        intent: "error",
      });

      navigate({ to: "/join" });
      return;
    }

    await queryClient.invalidateQueries(sessionQueryOptions());
    await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
    await navigate({ to: "/" });
  };

  onMount(() => {
    join();
  });

  return <div />;
}
