import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { availableClubsQueryOptions, lobbyQueryOptions } from "~/lib/queries";
import IconBuilding from "~icons/lucide/building";
import IconCheck from "~icons/lucide/check";
import IconX from "~icons/lucide/x";

export const Route = createFileRoute("/lobby/select-club")({
  component: SelectClubComponent,
});

function SelectClubComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onBack = () => navigate({ to: "/lobby" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());
  const availableClubsQuery = useQuery(() => availableClubsQueryOptions());

  const updateSelectedClubMutation = useMutation(() =>
    client.lobby.updateSelectedClub.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(lobbyQueryOptions());
        navigate({ to: "/lobby" });
      },
    }),
  );

  const menuItems: Accessor<MenuItem[]> = createMemo(() => {
    const items: MenuItem[] = [];
    const clubs = availableClubsQuery.data || [];
    const selectedClubId = lobbyQuery.data?.selectedClub?.id;

    // Option to clear selection
    if (selectedClubId) {
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-3">
            <IconX class="h-4 w-4" />
            <span>{t("lobby.noClub")}</span>
          </div>
        ),
        action: () => {
          updateSelectedClubMutation.mutate({ clubId: null });
        },
      });
    }

    // Available clubs
    for (const club of clubs) {
      const isSelected = club.id === selectedClubId;
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-3">
            {isSelected && <IconCheck class="h-4 w-4 text-green-400" />}
            <IconBuilding class="h-4 w-4" />
            <span class={isSelected ? "text-green-400" : ""}>{club.name}</span>
          </div>
        ),
        action: () => {
          if (!isSelected) {
            updateSelectedClubMutation.mutate({ clubId: club.id });
          }
        },
      });
    }

    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("lobby.selectClub")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" />
    </Layout>
  );
}
