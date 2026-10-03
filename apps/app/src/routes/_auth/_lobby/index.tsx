import { isDefinedError } from "@orpc/client";
import { Key } from "@solid-primitives/keyed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, For, type JSX, Match, Show, Suspense, Switch } from "solid-js";
import IconArrowClockwise from "~icons/ph/arrow-clockwise-bold";
import IconCaretRight from "~icons/ph/caret-right-bold";
import IconCheckCircle from "~icons/ph/check-circle-fill";
import IconCircleNotch from "~icons/ph/circle-notch-bold";
import IconSignOut from "~icons/ph/sign-out-bold";
import IconUserPlus from "~icons/ph/user-plus-bold";
import IconWarningCircle from "~icons/ph/warning-circle-fill";

import PageHeader from "~/components/page-header";
import SongCover from "~/components/song-cover";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import Tag from "~/components/ui/tag";
import { useGameConnection } from "~/contexts/game-client";
import { sessionQueryOptions } from "~/lib/auth";
import { useDialog } from "~/lib/dialog";
import { songsQueryOptions } from "~/lib/game-query";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { connectionStore, startConnection, stopConnection } from "~/stores/connection";

export const Route = createFileRoute("/_auth/_lobby/")({
  component: LobbyComponent,
});

function LobbyComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showDialog } = useDialog();
  const session = useQuery(() => sessionQueryOptions());
  const lobbyQuery = useQuery(() => client.lobby.currentLobby.queryOptions());

  const leave = async () => {
    const confirmed = await showDialog({
      title: t("lobby.leaveTitle"),
      description: t("lobby.leaveDescription"),
      intent: "delete",
      confirmLabel: t("lobby.leave"),
    });
    if (!confirmed) return;

    try {
      await client.lobby.leaveLobby.call();
    } catch {
      notify({ message: t("error.unknown"), intent: "error" });
      return;
    }

    await queryClient.invalidateQueries(sessionQueryOptions());
    await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
    await navigate({ to: "/join" });
  };

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4">
      <PageHeader
        title={t("lobby.title")}
        tag={lobbyQuery.data?.id ?? session.data?.lobbyId ?? undefined}
        subtitle={<ConnectionStatus />}
      />

      <div class="flex flex-col gap-6">
        {/* Its own boundary, so loading the song list doesn't blank the whole lobby screen. */}
        <Suspense fallback={<BrowseSongsPlaceholder />}>
          <BrowseSongs />
        </Suspense>
        <Players />
      </div>

      <button
        type="button"
        // Right under the players, styled like "Sign out" on the profile: on tall screens a bottom-pinned
        // button ends up far from everything else.
        class="mt-6 mb-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] bg-white/7 px-4 text-start font-bold text-red-300 transition-colors hover:bg-red-400/10"
        onClick={() => void leave()}
      >
        <IconSignOut />
        {t("lobby.leave")}
      </button>
    </main>
  );
}

function ConnectionStatus() {
  const session = useQuery(() => sessionQueryOptions());
  const state = () => connectionStore.connectionState();
  const connected = () => state() === "connected" && connectionStore.channelsReady();

  const retry = () => {
    const userId = session.data?.id;
    if (!userId) return;
    stopConnection();
    startConnection(userId);
  };

  return (
    <Switch
      fallback={
        <span class="flex items-center gap-1.5">
          <IconCircleNotch class="animate-spin" />
          {t("songs.connecting")}
        </span>
      }
    >
      <Match when={connected()}>
        <span class="flex items-center gap-1.5">
          <IconCheckCircle class="text-green-400" />
          {t("lobby.connected")}
        </span>
      </Match>
      <Match when={state() === "failed"}>
        <span class="flex items-center gap-1.5 text-red-300">
          <IconWarningCircle />
          {t("songs.connectionFailed")}
          <button
            type="button"
            class="ml-1 flex cursor-pointer items-center gap-1 rounded-[8px] bg-white/10 px-2 py-1 text-sm font-bold text-white hover:bg-white/15"
            onClick={retry}
          >
            <IconArrowClockwise />
            {t("songs.retry")}
          </button>
        </span>
      </Match>
    </Switch>
  );
}

function BrowseSongsPlaceholder() {
  return <div class="h-17 rounded-[14px] bg-white/7" aria-hidden="true" />;
}

/** The way into the song list: a preview of the first covers and the count, once connected to the game. */
function BrowseSongs() {
  const gameClient = useGameConnection();
  const songs = useQuery(() => ({
    // The game client is only used once it exists (enabled), so the non-null assertion is safe here.
    ...songsQueryOptions(gameClient()!),
    enabled: !!gameClient(),
  }));

  const preview = () => songs.data?.slice(0, 3) ?? [];

  const content = (): JSX.Element => (
    <>
      <div class="flex -space-x-3">
        <Show
          when={preview().length > 0}
          fallback={<span class="size-11 rounded-[8px] bg-white/15 ring-2 ring-black/20" />}
        >
          <For each={preview()}>
            {(song) => (
              <SongCover hash={song.hash} client={gameClient()} class="size-11 rounded-[8px] ring-2 ring-black/20" />
            )}
          </For>
        </Show>
      </div>
      <div class="flex min-w-0 grow flex-col">
        <span class="text-[17px] font-black">{t("lobby.browseSongs")}</span>
        <span class="truncate text-sm text-white/80">
          {songs.data ? t("lobby.songCount", { count: songs.data.length }) : t("songs.connecting")}
        </span>
      </div>
      <IconCaretRight class="shrink-0 text-lg" />
    </>
  );

  return (
    <Show
      when={gameClient()}
      fallback={
        <div
          class="gradient-sing flex items-center gap-3 rounded-[14px] bg-linear-to-r p-3 opacity-50"
          aria-disabled="true"
        >
          {content()}
        </div>
      }
    >
      <Link
        to="/songs"
        class="gradient-sing flex items-center gap-3 rounded-[14px] bg-linear-to-r p-3 shadow-crisp transition-transform active:scale-[0.98]"
      >
        {content()}
      </Link>
    </Show>
  );
}

function Players() {
  const queryClient = useQueryClient();
  const session = useQuery(() => sessionQueryOptions());
  const lobbyQuery = useQuery(() => client.lobby.currentLobby.queryOptions());
  const clubsQuery = useQuery(() => client.club.getUserClubs.queryOptions());

  const [inviting, setInviting] = createSignal<string>();
  const [selectedClubId, setSelectedClubId] = createSignal<string>();

  const users = () => lobbyQuery.data?.users ?? [];

  /** Clubs you may invite to (owner or admin). */
  const invitableClubs = createMemo(() => {
    const userId = session.data?.id;
    if (!userId) return [];
    return (clubsQuery.data ?? []).filter((club) => {
      const role = club.members.find((member) => member.userId === userId)?.role;
      return role === "owner" || role === "admin";
    });
  });

  const clubsFor = (username: string) =>
    invitableClubs().filter((club) => !club.members.some((member) => member.user?.username === username));

  const startInvite = (username: string) => {
    const clubs = clubsFor(username);
    setSelectedClubId(clubs.length === 1 ? clubs[0]?.id : undefined);
    setInviting(username);
  };

  const closeInvite = () => {
    setInviting(undefined);
    setSelectedClubId(undefined);
  };

  const inviteMutation = useMutation(() =>
    client.club.invite.mutationOptions({
      onSuccess: (_data, variables) => {
        void queryClient.invalidateQueries({ queryKey: client.club.key() });
        const clubName = invitableClubs().find((club) => club.id === variables.clubId)?.name ?? "";
        notify({ intent: "success", message: t("lobby.memberInvited", { username: variables.username, clubName }) });
        closeInvite();
      },
      onError: (error, variables) => {
        if (isDefinedError(error) && error.code === "ALREADY_MEMBER") {
          notify({ intent: "error", message: t("clubs.alreadyMember", { username: variables.username }) });
          return;
        }
        if (isDefinedError(error) && error.code === "USER_NOT_FOUND") {
          notify({ intent: "error", message: t("clubs.userNotFound", { username: variables.username }) });
          return;
        }
        notify({ intent: "error", message: t("error.unknown") });
      },
    }),
  );

  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-xs font-black tracking-[0.2em] text-white/50 uppercase">
        {t("lobby.playersTitle")} · {users().length}
      </h2>

      <Show
        when={users().length > 0}
        fallback={<p class="py-4 text-white/50">{lobbyQuery.isPending ? t("common.loading") : t("lobby.noUsers")}</p>}
      >
        <div class="flex flex-col gap-2">
          <Key each={users()} by={(user) => user.id}>
            {(user) => {
              const isYou = () => user().id === session.data?.id;
              const canInvite = () => !isYou() && !!user().username && clubsFor(user().username ?? "").length > 0;
              return (
                <div class="flex min-h-14 items-center gap-3 rounded-[12px] bg-white/7 px-3 py-2">
                  <Avatar user={user()} class="shrink-0" />
                  <span class="min-w-0 grow truncate text-[17px] font-bold">{user().username}</span>
                  <Show when={isYou()}>
                    <Tag class="text-[11px]">{t("lobby.you")}</Tag>
                  </Show>
                  <Show when={canInvite()}>
                    <button
                      type="button"
                      class="flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-white/10 px-3 py-2 text-sm font-bold transition-colors hover:bg-white/15"
                      onClick={() => startInvite(user().username ?? "")}
                    >
                      <IconUserPlus />
                      {t("lobby.inviteToClub")}
                    </button>
                  </Show>
                </div>
              );
            }}
          </Key>
        </div>
      </Show>

      <Show when={inviting()}>
        {(username) => (
          <Dialog onClose={closeInvite} title={t("lobby.selectClub")}>
            <div class="flex flex-col gap-4">
              <Dialog.Description>{t("lobby.selectClubDescription", { username: username() })}</Dialog.Description>
              <div class="flex flex-col gap-2">
                <For each={clubsFor(username())}>
                  {(club) => {
                    const selected = () => selectedClubId() === club.id;
                    return (
                      <button
                        type="button"
                        aria-pressed={selected()}
                        aria-label={club.name}
                        class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] p-3 text-start transition-colors"
                        classList={{
                          "bg-white/14 ring-2 ring-white/60 ring-inset": selected(),
                          "bg-white/6 hover:bg-white/10": !selected(),
                        }}
                        onClick={() => setSelectedClubId(club.id)}
                      >
                        <span class="flex flex-col">
                          <span class="font-bold">{club.name}</span>
                          <span class="text-sm text-white/60">
                            {club.members.length === 1
                              ? t("clubs.membersOne", { count: club.members.length })
                              : t("clubs.membersOther", { count: club.members.length })}
                          </span>
                        </span>
                        <span
                          class="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
                          classList={{ "border-white bg-white": selected(), "border-white/30": !selected() }}
                        >
                          <Show when={selected()}>
                            <span class="size-2 rounded-full bg-slate-900" />
                          </Show>
                        </span>
                      </button>
                    );
                  }}
                </For>
              </div>
              <Button
                class="w-full"
                intent="gradient"
                disabled={!selectedClubId() || inviteMutation.isPending}
                loading={inviteMutation.isPending}
                onClick={() => {
                  const clubId = selectedClubId();
                  if (clubId) inviteMutation.mutate({ clubId, username: username() });
                }}
              >
                {t("lobby.inviteUser", { username: username() })}
              </Button>
            </div>
          </Dialog>
        )}
      </Show>
    </section>
  );
}
