import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { Navigate, createFileRoute, redirect, useNavigate } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { client } from "~/lib/orpc";

export const Route = createFileRoute("/lobby/$id")({
  component: RouteComponent,
  beforeLoad: async ({ context, params }) => {
    const userId = params.id;

    const lobby = await context.queryClient.ensureQueryData(client.lobby.currentLobby.queryOptions());

    if (!lobby) {
      throw redirect({ to: "/lobby" });
    }

    const user = lobby.users.find((user) => user.id === userId);
    if (!user) {
      throw redirect({ to: "/lobby" });
    }

    return { data: user };
  },
});

function RouteComponent() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/lobby" });
  const queryClient = useQueryClient();

  const lobbyQuery = createQuery(() => client.lobby.currentLobby.queryOptions());
  const user = () => lobbyQuery.data?.users.find((user) => user.id === params().id);

  const kickUserMutation = createMutation(() =>
    client.lobby.kickUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
        navigate({ to: "/lobby" });
      },
    })
  );

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: "Kick",
      action: () => {
        const u = user();

        if (!u) {
          return;
        }

        kickUserMutation.mutate({ userId: u.id });
      },
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Lobby" description={user()?.username || "?"} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Switch>
        <Match when={user()}>
          <Menu items={menuItems} onBack={onBack} gradient="gradient-lobby" />
        </Match>
        <Match when={!lobbyQuery.isPending && !user()}>
          <Navigate to="/lobby" />
        </Match>
      </Switch>
    </Layout>
  );
}
