import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/clubs/")({
  component: ClubsIndexComponent,
});

function ClubsIndexComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clubsQuery = useQuery(() => client.club.getUserClubs.queryOptions());
  const invitesQuery = useQuery(() => client.club.getUserInvites.queryOptions({ refetchInterval: 5000 }));

  const acceptInviteMutation = useMutation(() => ({
    mutationFn: async (clubId: string) => await client.club.acceptInvite.call({ clubId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
      ]);
      notify({
        message: "Successfully accepted invite",
        intent: "success",
      });
    },
  }));

  const declineInviteMutation = useMutation(() => ({
    mutationFn: async (clubId: string) => await client.club.declineInvite.call({ clubId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
      ]);
      notify({
        message: "Successfully declined invite",
        intent: "success",
      });
    },
  }));

  const handleAcceptInvite = (clubId: string) => {
    acceptInviteMutation.mutate(clubId);
  };

  const handleDeclineInvite = (clubId: string) => {
    declineInviteMutation.mutate(clubId);
  };

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <div class="flex w-150 max-w-full flex-col gap-4">
        <Card class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h1 class="font-bold text-xl">{t("clubs.yourClubs")}</h1>
            <Button intent="gradient" onClick={() => navigate({ to: "/clubs/create" })}>
              {t("clubs.create")}
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <Show when={clubsQuery.isPending}>
              <div class="text-center">{t("common.loading")}</div>
            </Show>

            <Show when={!clubsQuery.isPending && clubsQuery.data?.length}>
              <div class="flex flex-col gap-3">
                <For each={clubsQuery.data}>
                  {(club) => (
                    <Link to="/clubs/$id" params={{ id: club.id }}>
                      <div class="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                        <div>
                          <div class="font-semibold text-lg text-slate-800">{club.name}</div>
                          <div class="text-slate-500 text-sm">
                            {club.members.length === 1 
                              ? t("clubs.membersOne", { count: club.members.length })
                              : t("clubs.membersOther", { count: club.members.length })
                            }
                          </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <div class="-space-x-3 flex">
                            <For each={club.members.slice(0, 5)}>
                              {(member) => (
                                <div class="rounded-full border-3 border-white">
                                  <Show when={member.user}>
                                    {(user) => <Avatar user={user()} class="h-8 w-8" />}
                                  </Show>
                                </div>
                              )}
                            </For>
                            <Show when={club.members.length > 5}>
                              <div class="flex h-8 w-8 items-center justify-center rounded-full border-3 border-white bg-slate-600 text-xs">
                                +{club.members.length - 5}
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!clubsQuery.isPending && clubsQuery.data?.length === 0}>
              <div class="text-center text-slate-400">{t("clubs.noClubs")}</div>
            </Show>
          </div>
        </Card>

        <Show when={invitesQuery.data?.length}>
          <Card class="flex flex-col gap-4">
            <h3 class="font-bold text-xl">{t("clubs.invites")}</h3>
            <For each={invitesQuery.data}>
              {(invite) => (
                <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                  <div>
                    <div class="font-semibold text-slate-800">{invite.club?.name}</div>
                    <div class="text-slate-500 text-sm">{t("clubs.invitedBy", { username: invite.inviter?.username || "" })}</div>
                  </div>
                  <div class="flex gap-2">
                    <Button
                      intent="gradient"
                      loading={acceptInviteMutation.isPending && acceptInviteMutation.variables === invite.club?.id}
                      onClick={() => handleAcceptInvite(invite.club?.id || "")}
                    >
                      {t("clubs.accept")}
                    </Button>
                    <Button
                      intent="danger"
                      loading={declineInviteMutation.isPending && declineInviteMutation.variables === invite.club?.id}
                      onClick={() => handleDeclineInvite(invite.club?.id || "")}
                    >
                      {t("clubs.decline")}
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </Card>
        </Show>
      </div>
    </div>
  );
}
