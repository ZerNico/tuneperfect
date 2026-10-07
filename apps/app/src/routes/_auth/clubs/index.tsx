import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import IconCaretRight from "~icons/ph/caret-right-bold";
import IconCheck from "~icons/ph/check-bold";
import IconPlus from "~icons/ph/plus-bold";
import IconUsersThree from "~icons/ph/users-three-fill";
import IconX from "~icons/ph/x-bold";

import ClubBadge from "~/components/club-badge";
import PageHeader from "~/components/page-header";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/clubs/")({
  component: ClubsIndexComponent,
});

function ClubsIndexComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createClubDialog, setCreateClubDialog] = createSignal(false);

  const clubsQuery = useQuery(() => client.club.getUserClubs.queryOptions());
  const invitesQuery = useQuery(() => client.club.getUserInvites.queryOptions({ refetchInterval: 5000 }));
  const invitesCount = () => invitesQuery.data?.length ?? 0;

  const acceptInviteMutation = useMutation(() =>
    client.club.acceptInvite.mutationOptions({
      onError: () => notify({ message: t("error.unknown"), intent: "error" }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    }),
  );

  const declineInviteMutation = useMutation(() =>
    client.club.declineInvite.mutationOptions({
      onError: () => notify({ message: t("error.unknown"), intent: "error" }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    }),
  );

  const createClubMutation = useMutation(() =>
    client.club.createClub.mutationOptions({
      onError: () => notify({ message: t("error.unknown"), intent: "error" }),
      onSuccess: (club) => {
        queryClient.invalidateQueries({
          queryKey: client.club.key(),
        });
        navigate({ to: "/clubs/$id", params: { id: club.clubId } });
      },
    }),
  );

  const form = createForm(() => ({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      createClubMutation.mutate(value);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        name: v.pipe(
          v.string(),
          v.minLength(3, t("clubs.nameMinLength", { minLength: 3 })),
          v.maxLength(20, t("clubs.nameMaxLength", { maxLength: 20 })),
        ),
      }),
    },
  }));

  const handleAcceptInvite = (clubId: string) => {
    acceptInviteMutation.mutate({ clubId });
  };

  const handleDeclineInvite = (clubId: string) => {
    declineInviteMutation.mutate({ clubId });
  };

  const hasClubs = () => clubsQuery.isSuccess && (clubsQuery.data?.length ?? 0) > 0;

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4 pb-8">
      <PageHeader
        title={t("clubs.title")}
        action={
          // The empty state has its own button; one "create" on screen at a time.
          <Show when={hasClubs()}>
            <button
              type="button"
              aria-label={t("clubs.create")}
              class="gradient-accent flex size-11 cursor-pointer items-center justify-center rounded-[12px] text-xl transition-transform active:scale-95"
              onClick={() => setCreateClubDialog(true)}
            >
              <IconPlus />
            </button>
          </Show>
        }
      />

      <Show when={invitesQuery.isSuccess && invitesCount() > 0}>
        <section class="mb-8 flex flex-col gap-2">
          <h2 class="text-xs font-black tracking-[0.2em] text-white/50 uppercase">
            {t("clubs.invites")} · {invitesCount()}
          </h2>
          <For each={invitesQuery.data}>
            {(invite) => (
              <div class="flex flex-col gap-3 rounded-[14px] bg-white/7 p-3">
                <div class="flex items-center gap-3">
                  <ClubBadge name={invite.club?.name ?? ""} />
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-[17px] font-bold">{invite.club?.name}</span>
                    <span class="truncate text-sm text-white/60">
                      {t("clubs.invitedBy", { username: invite.inviter?.username || "" })}
                    </span>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    loading={
                      declineInviteMutation.isPending && declineInviteMutation.variables.clubId === invite.club?.id
                    }
                    onClick={() => handleDeclineInvite(invite.club?.id || "")}
                  >
                    <IconX />
                    {t("clubs.decline")}
                  </Button>
                  <Button
                    type="button"
                    intent="gradient"
                    loading={
                      acceptInviteMutation.isPending && acceptInviteMutation.variables.clubId === invite.club?.id
                    }
                    onClick={() => handleAcceptInvite(invite.club?.id || "")}
                  >
                    <IconCheck />
                    {t("clubs.accept")}
                  </Button>
                </div>
              </div>
            )}
          </For>
        </section>
      </Show>

      <Show when={clubsQuery.isPending}>
        <p class="py-4 text-white/50">{t("common.loading")}</p>
      </Show>

      <Show when={hasClubs()}>
        <section class="flex flex-col gap-2">
          <Show when={invitesCount() > 0}>
            <h2 class="text-xs font-black tracking-[0.2em] text-white/50 uppercase">{t("clubs.yourClubs")}</h2>
          </Show>
          <For each={clubsQuery.data}>
            {(club) => (
              <Link
                to="/clubs/$id"
                params={{ id: club.id }}
                class="flex min-h-16 items-center gap-3 rounded-[14px] bg-white/7 p-3 transition-colors hover:bg-white/10"
              >
                <ClubBadge name={club.name} />
                <div class="flex min-w-0 grow flex-col">
                  <span class="truncate text-[17px] font-bold">{club.name}</span>
                  <span class="text-sm text-white/60">
                    {club.members.length === 1
                      ? t("clubs.membersOne", { count: club.members.length })
                      : t("clubs.membersOther", { count: club.members.length })}
                  </span>
                </div>
                <div class="flex shrink-0 -space-x-2">
                  <For each={club.members.slice(0, 3)}>
                    {(member) => (
                      <Show when={member.user}>
                        {(user) => (
                          // The ring only separates overlapping avatars; a lone avatar looks like everywhere else.
                          <Avatar
                            user={user()}
                            size="sm"
                            class={club.members.length > 1 ? "rounded-full ring-2 ring-black/30" : undefined}
                          />
                        )}
                      </Show>
                    )}
                  </For>
                </div>
                <IconCaretRight class="shrink-0 text-white/40" />
              </Link>
            )}
          </For>
        </section>
      </Show>

      <Show when={clubsQuery.isSuccess && !clubsQuery.data?.length}>
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <span class="gradient-accent flex size-16 items-center justify-center rounded-[18px] text-3xl">
            <IconUsersThree />
          </span>
          <h2 class="mt-2 text-xl font-bold">{t("clubs.noClubs")}</h2>
          <p class="max-w-xs text-white/60">{t("clubs.noClubsDescription")}</p>
          <Button intent="gradient" class="mt-3" onClick={() => setCreateClubDialog(true)}>
            <IconPlus />
            {t("clubs.create")}
          </Button>
        </div>
      </Show>

      <Show when={createClubDialog()}>
        <Dialog onClose={() => setCreateClubDialog(false)} title={t("clubs.create")}>
          <form
            class="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <Input
                  label={t("clubs.name")}
                  name={field().name}
                  value={field().state.value}
                  onBlur={field().handleBlur}
                  onInput={(e) => field().handleChange(e.currentTarget.value)}
                  errorMessage={field().state.meta.errors?.[0]?.message}
                  autofocus
                />
              )}
            </form.Field>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {(state) => (
                <Button
                  type="submit"
                  class="w-full"
                  intent="gradient"
                  loading={state().isSubmitting || createClubMutation.isPending}
                >
                  {t("clubs.create")}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </Dialog>
      </Show>
    </main>
  );
}
