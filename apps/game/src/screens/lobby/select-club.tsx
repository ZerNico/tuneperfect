import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import IconBuilding from "~icons/ph/buildings-fill";
import IconX from "~icons/ph/x-bold";

import TagChip from "~/components/fx/tag-chip";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { availableClubsQueryOptions, lobbyQueryOptions } from "~/lib/queries";

export default function SelectClubScreen() {
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

    // Available clubs; the current one is marked and is where the cursor starts.
    for (const club of clubs) {
      const isSelected = club.id === selectedClubId;
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-3">
            <IconBuilding class="h-4 w-4" />
            <span>{club.name}</span>
            {isSelected && <TagChip label={t("lobby.current")} class="text-xs" />}
          </div>
        ),
        action: () => {
          if (isSelected) navigate({ to: "/lobby" });
          else updateSelectedClubMutation.mutate({ clubId: club.id });
        },
      });
    }

    return items;
  });

  // "No Club" comes first when a club is selected, so the current club sits at 1 + its index.
  const currentIndex = createMemo(() => {
    const selectedId = lobbyQuery.data?.selectedClub?.id;
    if (!selectedId) return undefined;
    const index = (availableClubsQuery.data ?? []).findIndex((club) => club.id === selectedId);
    return index >= 0 ? index + 1 : undefined;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("lobby.selectClub")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" initialIndex={currentIndex()} />
    </Layout>
  );
}
