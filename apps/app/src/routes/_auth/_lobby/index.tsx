import { Key } from "@solid-primitives/keyed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { For, Show, createSignal } from "solid-js";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Dialog from "~/components/ui/dialog";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/_lobby/")({
  component: LobbyComponent,
  beforeLoad: async () => {},
});

function LobbyComponent() {
  const queryClient = useQueryClient();
  const [inviteDialog, setInviteDialog] = createSignal(false);
  const [selectedClubId, setSelectedClubId] = createSignal<string>("");
  const [selectedUser, setSelectedUser] = createSignal<string>("");

  const lobbyQuery = useQuery(() => client.lobby.currentLobby.queryOptions());
  const clubsQuery = useQuery(() => client.club.getUserClubs.queryOptions());
  const session = useQuery(() => sessionQueryOptions());

  // Filter clubs where user can invite (owner or admin)
  const clubsWithInvitePermission = () => {
    if (!clubsQuery.data || !session.data?.id) return [];
    const currentUserId = session.data.id;
    return clubsQuery.data.filter((club) => {
      const userMember = club.members.find((m) => m.userId === currentUserId);
      return userMember && (userMember.role === "owner" || userMember.role === "admin");
    });
  };

  // Filter clubs where a specific user can be invited (not already a member)
  const availableClubsForUser = (username: string) => {
    return clubsWithInvitePermission().filter((club) => {
      // Check if the user is already a member of this club
      const isUserAlreadyMember = club.members.some((member) => member.user?.username === username);
      return !isUserAlreadyMember;
    });
  };

  const inviteMutation = useMutation(() => ({
    mutationFn: async (data: { clubId: string; username: string }) => {
      return await client.club.invite.call({ clubId: data.clubId, username: data.username });
    },
    onSuccess: async () => {
      const club = clubsQuery.data?.find((c) => c.id === selectedClubId());

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);

      notify({
        intent: "success",
        message: t("lobby.memberInvited", {
          username: selectedUser(),
          clubName: club?.name || "Unknown Club",
        }),
      });

      setInviteDialog(false);
      setSelectedClubId("");
      setSelectedUser("");
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const handleInviteUser = (username: string) => {
    setSelectedUser(username);
    setInviteDialog(true);
  };

  const handleInviteToClub = () => {
    if (!selectedClubId() || !selectedUser()) return;

    inviteMutation.mutate({
      clubId: selectedClubId(),
      username: selectedUser(),
    });
  };

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <div class="flex w-150 max-w-full flex-col gap-4">
        <Card class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h1 class="font-bold text-xl">{t("lobby.title")}</h1>
          </div>

          <div class="flex flex-col gap-2">
            <Show when={lobbyQuery.isPending}>
              <div class="text-center">{t("common.loading")}</div>
            </Show>

            <Show when={!lobbyQuery.isPending && lobbyQuery.data?.users?.length}>
              <div class="flex flex-col gap-3">
                <Key each={lobbyQuery.data?.users || []} by={(user) => user.id}>
                  {(user) => (
                    <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                      <div class="flex items-center gap-3">
                        <Avatar class="flex-shrink-0" user={user()} />
                        <div>
                          <div class="font-semibold text-slate-800">{user().username}</div>
                        </div>
                      </div>
                      <Show when={user().username}>
                        {(username) => (
                          <Show when={availableClubsForUser(username()).length > 0}>
                            <Button intent="gradient" onClick={() => handleInviteUser(username())}>
                              {t("lobby.invite")}
                            </Button>
                          </Show>
                        )}
                      </Show>
                    </div>
                  )}
                </Key>
              </div>
            </Show>

            <Show when={!lobbyQuery.isPending && (!lobbyQuery.data?.users || lobbyQuery.data.users.length === 0)}>
              <div class="text-center text-slate-400">No users in lobby</div>
            </Show>
          </div>
        </Card>
      </div>

      <Show when={inviteDialog()}>
        <Dialog
          onClose={() => {
            setInviteDialog(false);
            setSelectedClubId("");
            setSelectedUser("");
          }}
          title={t("lobby.selectClub")}
        >
          <div class="flex flex-col gap-4">
            <p class="text-slate-600">{t("lobby.selectClubDescription", { username: selectedUser() })}</p>

            <div class="flex flex-col gap-3">
              <For each={availableClubsForUser(selectedUser())}>
                {(club) => (
                  <button
                    type="button"
                    class="flex cursor-pointer items-center justify-between rounded-lg border-2 p-4 text-start transition-all hover:scale-[1.02] hover:shadow-md"
                    classList={{
                      "border-blue-500 bg-blue-50 shadow-md": selectedClubId() === club.id,
                      "border-slate-200 bg-white hover:border-slate-300": selectedClubId() !== club.id,
                    }}
                    onClick={() => setSelectedClubId(club.id)}
                  >
                    <div class="flex items-center gap-3">
                      <div>
                        <div class="font-semibold text-slate-800">{club.name}</div>
                        <div class="text-slate-500 text-sm">
                          {club.members.length === 1
                            ? t("clubs.membersOne", { count: club.members.length })
                            : t("clubs.membersOther", { count: club.members.length })}
                        </div>
                      </div>
                    </div>
                    <div
                      class="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all"
                      classList={{
                        "border-blue-500 bg-blue-500": selectedClubId() === club.id,
                        "border-slate-300 bg-white": selectedClubId() !== club.id,
                      }}
                    >
                      <Show when={selectedClubId() === club.id}>
                        <div class="h-2 w-2 rounded-full bg-white" />
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>

            <Button
              class="w-full"
              intent="gradient"
              disabled={!selectedClubId() || inviteMutation.isPending}
              loading={inviteMutation.isPending}
              onClick={handleInviteToClub}
            >
              {t("lobby.inviteUser", { username: selectedUser() })}
            </Button>
          </div>
        </Dialog>
      </Show>
    </div>
  );
}
