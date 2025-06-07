import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/solid-router";
import { For, Show, createSignal } from "solid-js";
import * as v from "valibot";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Dialog from "~/components/ui/dialog";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import IconArrowRight from "~icons/lucide/arrow-right";
import IconCheck from "~icons/lucide/check";
import IconPlus from "~icons/lucide/plus";
import IconUsers from "~icons/lucide/users";
import IconX from "~icons/lucide/x";

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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    })
  );

  const declineInviteMutation = useMutation(() =>
    client.club.declineInvite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    })
  );

  const createClubMutation = useMutation(() =>
    client.club.createClub.mutationOptions({
      onSuccess: (club) => {
        queryClient.invalidateQueries({
          queryKey: client.club.key(),
        });
        navigate({ to: "/clubs/$id", params: { id: club.clubId } });
      },
    })
  );

  const form = createForm(() => ({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      createClubMutation.mutate(value);
    },
    validators: {
      onChange: v.object({
        name: v.pipe(v.string(), v.minLength(3, t("clubs.nameMinLength", { minLength: 3 })), v.maxLength(20, t("clubs.nameMaxLength", { maxLength: 20 }))),
      }),
    },
  }));

  const handleAcceptInvite = (clubId: string) => {
    acceptInviteMutation.mutate({ clubId });
  };

  const handleDeclineInvite = (clubId: string) => {
    declineInviteMutation.mutate({ clubId });
  };

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-3xl">{t("clubs.title")}</h1>
        <Button intent="gradient" onClick={() => setCreateClubDialog(true)}>
          {t("clubs.create")}
        </Button>
      </div>

      <Show when={invitesQuery.isSuccess && invitesCount() > 0}>
        <div class="mb-8">
          <div class="mb-4 flex items-start gap-1">
            <h2 class="font-bold text-2xl">{t("clubs.invites")}</h2>
            <span class="text-sm">{invitesCount()}</span>
          </div>
          <div class="flex flex-col gap-4">
            <For each={invitesQuery.data}>
              {(invite) => (
                <Card class="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
                  <div>
                    <div class="font-semibold text-slate-800">{invite.club?.name}</div>
                    <div class="text-slate-500 text-sm">{t("clubs.invitedBy", { username: invite.inviter?.username || "" })}</div>
                  </div>
                  <div class="flex w-full shrink-0 gap-2 sm:w-auto">
                    <Button
                      type="button"
                      intent="gradient"
                      class="w-full"
                      loading={acceptInviteMutation.isPending && acceptInviteMutation.variables.clubId === invite.club?.id}
                      onClick={() => handleAcceptInvite(invite.club?.id || "")}
                    >
                      <IconCheck class="mr-2 h-4 w-4" />
                      {t("clubs.accept")}
                    </Button>
                    <Button
                      type="button"
                      intent="danger"
                      class="w-full"
                      loading={declineInviteMutation.isPending && declineInviteMutation.variables.clubId === invite.club?.id}
                      onClick={() => handleDeclineInvite(invite.club?.id || "")}
                    >
                      <IconX class="mr-2 h-4 w-4" />
                      {t("clubs.decline")}
                    </Button>
                  </div>
                </Card>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div>
        <h2 class="mb-4 font-bold text-2xl">{t("clubs.yourClubs")}</h2>
        <Show when={clubsQuery.isPending}>
          <div class="text-center">{t("common.loading")}</div>
        </Show>
        <Show when={clubsQuery.isSuccess && clubsQuery.data?.length}>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={clubsQuery.data}>
              {(club) => (
                <Link to="/clubs/$id" params={{ id: club.id }} class="group">
                  <Card class="flex h-full flex-col justify-between transition-all group-hover:scale-105 group-hover:shadow-lg">
                    <div>
                      <div class="font-bold text-lg">{club.name}</div>
                      <div class="text-slate-500 text-sm">
                        {club.members.length === 1
                          ? t("clubs.membersOne", { count: club.members.length })
                          : t("clubs.membersOther", { count: club.members.length })}
                      </div>
                    </div>
                    <div class="mt-4 flex items-center justify-between">
                      <div class="-space-x-3 flex">
                        <For each={club.members.slice(0, 5)}>
                          {(member) => (
                            <div class="rounded-full border-2 border-white">
                              <Show when={member.user}>{(user) => <Avatar user={user()} class="h-8 w-8" />}</Show>
                            </div>
                          )}
                        </For>
                        <Show when={club.members.length > 5}>
                          <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-600 text-white text-xs">
                            +{club.members.length - 5}
                          </div>
                        </Show>
                      </div>
                      <IconArrowRight class="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Card>
                </Link>
              )}
            </For>
          </div>
        </Show>
        <Show when={clubsQuery.isSuccess && !clubsQuery.data?.length}>
          <div class="py-12 text-center">
            <IconUsers class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 font-medium text-gray-900 text-sm">{t("clubs.noClubs")}</h3>
            <p class="mt-1 text-gray-500 text-sm">{t("clubs.noClubsDescription")}</p>
            <div class="mt-6">
              <Button intent="gradient" onClick={() => setCreateClubDialog(true)}>
                <IconPlus class="mr-2 h-5 w-5" />
                {t("clubs.create")}
              </Button>
            </div>
          </div>
        </Show>
      </div>
      <Show when={createClubDialog()}>
        <Dialog onClose={() => setCreateClubDialog(false)} title={t("clubs.create")}>
          <form
            class="mt-4 flex flex-col gap-4"
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
                <Button type="submit" class="w-full" intent="gradient" loading={state().isSubmitting || createClubMutation.isPending}>
                  {t("clubs.create")}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </Dialog>
      </Show>
    </div>
  );
}
