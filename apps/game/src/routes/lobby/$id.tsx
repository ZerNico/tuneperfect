import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Navigate, createFileRoute, redirect, useNavigate } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { lobbyQueryOptions } from "~/lib/queries";

export const Route = createFileRoute("/lobby/$id")({
  component: RouteComponent,
  beforeLoad: async ({ context, params }) => {
    const userId = params.id;

    const lobby = await context.queryClient.ensureQueryData(lobbyQueryOptions());

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

  const lobbyQuery = useQuery(() => lobbyQueryOptions());
  const user = () => lobbyQuery.data?.users.find((user) => user.id === params().id);

  const kickUserMutation = useMutation(() =>
    client.lobby.kickUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(lobbyQueryOptions());
        navigate({ to: "/lobby" });
      },
    })
  );

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("lobby.kick"),
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
      header={<TitleBar title={t("lobby.title")} description={user()?.username || "?"} onBack={onBack} />}
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
