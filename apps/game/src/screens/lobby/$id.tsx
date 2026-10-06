import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Navigate, useNavigate, getRouteApi } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { select, type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { lobbyQueryOptions } from "~/lib/queries";
import { lobbyStore } from "~/stores/lobby";
import { webrtcStore } from "~/stores/webrtc";

const route = getRouteApi("/lobby/$id");

export default function RouteScreen() {
  const params = route.useParams();
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/lobby" });
  const queryClient = useQueryClient();

  const lobbyQuery = useQuery(() => lobbyQueryOptions());
  const user = () => lobbyQuery.data?.users.find((user) => user.id === params().id);

  const kickUserMutation = useMutation(() =>
    client.lobby.kickUser.mutationOptions({
      onSuccess: async (_data, variables) => {
        // Close WebRTC connection when user is kicked
        webrtcStore.closeConnection(variables.userId);
        lobbyStore.setRemoteControl(variables.userId, false);
        await queryClient.invalidateQueries(lobbyQueryOptions());
        navigate({ to: "/lobby" });
      },
    }),
  );

  const menuItems: MenuItem[] = [
    // Lets them drive the whole game from their phone, menus included.
    select({
      label: t("lobby.remoteControl"),
      value: () => (lobbyStore.remoteControlIds().includes(params().id) ? "yes" : "no"),
      options: ["no", "yes"],
      onChange: (value) => lobbyStore.setRemoteControl(params().id, value === "yes"),
      renderValue: (value) => t(`common.${value as "yes" | "no"}`),
    }),
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
