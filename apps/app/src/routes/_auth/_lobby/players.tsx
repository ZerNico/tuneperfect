import { isDefinedError } from "@orpc/client";
import { Key } from "@solid-primitives/keyed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconUserPlus from "~icons/lucide/user-plus";
import IconUsers from "~icons/lucide/users";

export const Route = createFileRoute("/_auth/_lobby/players")({
  component: PlayersComponent,
});

function PlayersComponent() {
  const queryClient = useQueryClient();
  const [selectedClubId, setSelectedClubId] = createSignal<string>("");
  const [selectedUser, setSelectedUser] = createSignal<string>("");

  const lobbyQuery = useQuery(() => client.lobby.currentLobby.queryOptions());
  const clubsQuery = useQuery(() => client.club.getUserClubs.queryOptions());
  const session = useQuery(() => sessionQueryOptions());

  const clubsWithInvitePermission = () => {
    if (!clubsQuery.data || !session.data?.id) return [];
    const currentUserId = session.data.id;
    return clubsQuery.data.filter((club) => {
      const userMember = club.members.find((m) => m.userId === currentUserId);
      return userMember && (userMember.role === "owner" || userMember.role === "admin");
    });
  };

  const availableClubsForUser = (username: string) => {
    return clubsWithInvitePermission().filter((club) => {
      const isUserAlreadyMember = club.members.some((member) => member.user?.username === username);
      return !isUserAlreadyMember;
    });
  };

  const inviteMutation = useMutation(() =>
    client.club.invite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        setSelectedClubId("");
        setSelectedUser("");
      },
      onError: (error) => {
        if (isDefinedError(error)) {
          if (error.code === "ALREADY_MEMBER") {
            notify({
              intent: "error",
              message: t("clubs.alreadyMember", { username: selectedUser() }),
            });
            return;
          }
          if (error.code === "USER_NOT_FOUND") {
            notify({
              intent: "error",
              message: t("clubs.userNotFound", { username: selectedUser() }),
            });
            return;
          }
        }

        notify({
          intent: "error",
          message: t("error.unknown"),
        });
      },
    }),
  );

  const handleInviteUser = (username: string) => {
    setSelectedUser(username);
    const availableClubs = availableClubsForUser(username);
    if (availableClubs.length === 1) {
      setSelectedClubId(availableClubs[0].id);
    }
  };

  const handleInviteToClub = () => {
    if (!selectedClubId() || !selectedUser()) return;

    inviteMutation.mutate({
      clubId: selectedClubId(),
      username: selectedUser(),
    });
  };

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6">
        <Link to="/" class="mb-2 flex items-center gap-1 text-white/70 transition-colors hover:text-white">
          <IconChevronLeft class="h-5 w-5" />
          <span class="text-sm">{t("lobby.title")}</span>
        </Link>
        <h1 class="font-bold text-3xl">{t("lobby.playersTitle")}</h1>
      </div>

      <Show
        when={!lobbyQuery.isPending && lobbyQuery.data?.users?.length}
        fallback={
          <Show
            when={lobbyQuery.isPending}
            fallback={
              <div class="py-12 text-center">
                <IconUsers class="mx-auto h-12 w-12 text-gray-400" />
                <h3 class="mt-2 font-medium text-gray-900 text-sm">{t("lobby.noUsers")}</h3>
                <p class="mt-1 text-gray-500 text-sm">{t("lobby.noUsersDescription")}</p>
              </div>
            }
          >
            <div class="text-center">{t("common.loading")}</div>
          </Show>
        }
      >
        <div class="flex flex-col gap-3">
          <Key each={lobbyQuery.data?.users || []} by={(user) => user.id}>
            {(user) => (
              <div class="flex items-center justify-between rounded-lg bg-white p-4">
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
                        <IconUserPlus class="mr-2 h-4 w-4" />
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

      <Show when={selectedUser()}>
        <Dialog
          onClose={() => {
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
                    class="flex w-full cursor-pointer items-center justify-between rounded-lg border-2 p-4 text-start transition-all hover:scale-[1.02] hover:shadow-md"
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
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
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
