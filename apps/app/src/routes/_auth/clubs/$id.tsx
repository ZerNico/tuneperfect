import { isDefinedError } from "@orpc/client";
import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import IconCrown from "~icons/ph/crown-fill";
import IconDotsThree from "~icons/ph/dots-three-vertical-bold";
import IconGear from "~icons/ph/gear-six-fill";
import IconPencil from "~icons/ph/pencil-simple-bold";
import IconShield from "~icons/ph/shield-fill";
import IconShieldPlus from "~icons/ph/shield-plus-bold";
import IconShieldMinus from "~icons/ph/shield-slash-bold";
import IconSignOut from "~icons/ph/sign-out-bold";
import IconTrash from "~icons/ph/trash-bold";
import IconUserMinus from "~icons/ph/user-minus-bold";
import IconUserPlus from "~icons/ph/user-plus-bold";

import PageHeader from "~/components/page-header";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import DropdownMenu from "~/components/ui/dropdown-menu";
import Input from "~/components/ui/input";
import Tag from "~/components/ui/tag";
import { sessionQueryOptions } from "~/lib/auth";
import { useDialog } from "~/lib/dialog";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/clubs/$id")({
  component: ClubDetailComponent,
  beforeLoad: async ({ params, context }) => {
    await context.queryClient.prefetchQuery(client.club.getClub.queryOptions({ input: { clubId: params.id } }));
  },
});

type MenuItem = {
  label: string;
  icon: typeof IconCrown;
  onSelect: () => void;
  class?: string;
};

function getMemberMenuItems(
  member: { user?: { id: string; username: string | null } | null; role: string },
  currentUserRole: string | undefined,
  handlers: {
    removeMember: (userId: string, username: string) => void;
    transferOwnership: (userId: string, username: string) => void;
    changeRole: (userId: string, username: string, role: "admin" | "member") => void;
  },
): MenuItem[] {
  const items: MenuItem[] = [];
  const userId = member.user?.id;
  const username = member.user?.username ?? "";

  if (!userId || !username) return items;

  if (canRemoveMember(currentUserRole, member.role)) {
    items.push({
      label: t("clubs.detail.removeMember"),
      icon: IconUserMinus,
      onSelect: () => handlers.removeMember(userId, username),
      class: "text-red-300",
    });
  }

  if (currentUserRole === "owner") {
    items.push({
      label: t("clubs.detail.transferOwnership"),
      icon: IconCrown,
      onSelect: () => handlers.transferOwnership(userId, username),
    });
  }

  if (member.role === "member" && (currentUserRole === "owner" || currentUserRole === "admin")) {
    items.push({
      label: t("clubs.detail.makeAdmin"),
      icon: IconShieldPlus,
      onSelect: () => handlers.changeRole(userId, username, "admin"),
    });
  }

  if (member.role === "admin" && currentUserRole === "owner") {
    items.push({
      label: t("clubs.detail.removeAdmin"),
      icon: IconShieldMinus,
      onSelect: () => handlers.changeRole(userId, username, "member"),
    });
  }

  return items;
}

function MemberActions(props: {
  member: { user?: { id: string; username: string | null } | null; role: string };
  currentUserRole: string | undefined;
  handlers: {
    removeMember: (userId: string, username: string) => void;
    transferOwnership: (userId: string, username: string) => void;
    changeRole: (userId: string, username: string, role: "admin" | "member") => void;
  };
}) {
  // oxlint-disable-next-line solid/reactivity
  const menuItems = getMemberMenuItems(props.member, props.currentUserRole, props.handlers);

  return (
    <Show when={menuItems.length > 0}>
      <DropdownMenu
        trigger={
          <DropdownMenu.Trigger
            aria-label={t("clubs.detail.memberOptions")}
            class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconDotsThree />
          </DropdownMenu.Trigger>
        }
      >
        <For each={menuItems}>
          {(item) => (
            <DropdownMenu.Item class={item.class} onSelect={item.onSelect}>
              <item.icon /> {item.label}
            </DropdownMenu.Item>
          )}
        </For>
      </DropdownMenu>
    </Show>
  );
}

function ClubDetailComponent() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useQuery(() => sessionQueryOptions());
  const { showDialog } = useDialog();

  const clubQuery = useQuery(() => ({
    ...client.club.getClub.queryOptions({ input: { clubId: params().id } }),
  }));

  const deleteClubMutation = useMutation(() =>
    client.club.deleteClub.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        navigate({ to: "/clubs" });
      },
    }),
  );

  const removeMemberMutation = useMutation(() =>
    client.club.removeMember.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    }),
  );

  const transferOwnershipMutation = useMutation(() =>
    client.club.transferOwnership.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    }),
  );

  const inviteMemberMutation = useMutation(() =>
    client.club.invite.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        setDialog(null);
        inviteForm.reset();
        notify({
          intent: "success",
          message: t("lobby.memberInvited", { username: variables.username, clubName: clubQuery.data?.name ?? "" }),
        });
      },
      onError: (error, variables) => {
        if (isDefinedError(error) && error.code === "USER_NOT_FOUND") {
          notify({ intent: "error", message: t("clubs.userNotFound", { username: variables.username }) });
          return;
        }
        if (isDefinedError(error) && error.code === "ALREADY_MEMBER") {
          notify({ intent: "error", message: t("clubs.alreadyMember", { username: variables.username }) });
          return;
        }
        notify({ intent: "error", message: t("error.unknown") });
      },
    }),
  );

  const changeRoleMutation = useMutation(() =>
    client.club.changeRole.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
      },
    }),
  );

  const leaveClubMutation = useMutation(() =>
    client.club.leaveClub.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        navigate({ to: "/clubs" });
      },
    }),
  );

  const updateClubMutation = useMutation(() =>
    client.club.updateClub.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        setDialog(null);
      },
    }),
  );

  const inviteForm = createForm(() => ({
    defaultValues: {
      username: "",
    },
    onSubmit: async ({ value }) => {
      inviteMemberMutation.mutate({ clubId: params().id, ...value });
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        username: v.pipe(v.string(), v.minLength(1, t("clubs.detail.usernameRequired"))),
      }),
    },
  }));

  const renameForm = createForm(() => ({
    defaultValues: {
      name: clubQuery.data?.name ?? "",
    },
    onSubmit: async ({ value }) => {
      updateClubMutation.mutate({ clubId: params().id, ...value });
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        name: v.pipe(
          v.string(),
          v.nonEmpty(t("clubs.detail.nameRequired")),
          v.minLength(3, t("clubs.nameMinLength", { minLength: 3 })),
          v.maxLength(20, t("clubs.nameMaxLength", { maxLength: 20 })),
        ),
      }),
    },
  }));

  const handleDeleteClub = async () => {
    const confirmed = await showDialog({
      title: t("clubs.detail.delete"),
      description: <p>{t("clubs.detail.deleteConfirmation")}</p>,
      intent: "delete",
      confirmLabel: t("clubs.detail.delete"),
    });

    if (!confirmed) return;

    deleteClubMutation.mutate({ clubId: params().id });
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.removeMember"),
      description: <p>{t("clubs.detail.removeMemberConfirmation", { username })}</p>,
      intent: "delete",
      confirmLabel: t("clubs.detail.removeMember"),
    });

    if (!confirmed) return;

    removeMemberMutation.mutate({ clubId: params().id, userId });
  };

  const handleTransferOwnership = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.transferOwnership"),
      description: <p>{t("clubs.detail.transferOwnershipConfirmation", { username })}</p>,
      intent: "delete",
      confirmLabel: t("clubs.detail.transferOwnership"),
    });

    if (!confirmed) return;

    transferOwnershipMutation.mutate({ clubId: params().id, userId });
  };

  const handleChangeRole = async (userId: string, username: string, newRole: "admin" | "member") => {
    const confirmed = await showDialog({
      title: t("clubs.detail.changeRole"),
      description: (
        <p>
          {t("clubs.detail.changeRoleConfirmation", {
            username,
            role: newRole === "admin" ? t("clubs.detail.roleAdmin") : t("clubs.detail.roleMember"),
          })}
        </p>
      ),
      intent: "confirm",
      confirmLabel: t("clubs.detail.changeRole"),
    });

    if (!confirmed) return;

    changeRoleMutation.mutate({ clubId: params().id, userId, role: newRole });
  };

  const [dialog, setDialog] = createSignal<"invite" | "rename" | null>(null);

  const currentUserRole = () => {
    return clubQuery.data?.members.find((m) => m.userId === session.data?.id)?.role;
  };

  const handleLeaveClub = async () => {
    const confirmed = await showDialog({
      title: t("clubs.detail.leave"),
      description: <p>{t("clubs.detail.leaveConfirmation")}</p>,
      intent: "delete",
      confirmLabel: t("clubs.detail.leave"),
    });

    if (!confirmed) return;

    leaveClubMutation.mutate({ clubId: params().id });
  };

  const canInvite = () => currentUserRole() === "owner" || currentUserRole() === "admin";

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4 pb-8">
      <Show
        when={clubQuery.data}
        fallback={
          <>
            <PageHeader back={{ to: "/clubs", label: t("clubs.title") }} title="" />
            <p class="text-white/50">{t("common.loading")}</p>
          </>
        }
      >
        {(club) => (
          <>
            <PageHeader
              back={{ to: "/clubs", label: t("clubs.title") }}
              title={club().name}
              action={
                <DropdownMenu
                  trigger={
                    <DropdownMenu.Trigger
                      aria-label={t("clubs.detail.settings")}
                      class="flex size-11 cursor-pointer items-center justify-center rounded-[12px] bg-white/8 text-xl transition-colors hover:bg-white/12"
                    >
                      <IconGear />
                    </DropdownMenu.Trigger>
                  }
                >
                  <Show when={currentUserRole() === "owner"}>
                    <DropdownMenu.Item onSelect={() => setDialog("rename")}>
                      <IconPencil /> {t("clubs.detail.rename")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="text-red-300" onSelect={handleDeleteClub}>
                      <IconTrash /> {t("clubs.detail.delete")}
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={currentUserRole() !== "owner"}>
                    <DropdownMenu.Item class="text-red-300" onSelect={handleLeaveClub}>
                      <IconSignOut /> {t("clubs.detail.leave")}
                    </DropdownMenu.Item>
                  </Show>
                </DropdownMenu>
              }
            />

            <Show when={canInvite()}>
              <Button intent="gradient" class="mb-6 w-full" onClick={() => setDialog("invite")}>
                <IconUserPlus /> {t("clubs.detail.inviteMember")}
              </Button>
            </Show>

            <section class="flex flex-col gap-2">
              <h2 class="text-xs font-black tracking-[0.2em] text-white/50 uppercase">
                {club().members.length === 1
                  ? t("clubs.membersOne", { count: club().members.length })
                  : t("clubs.membersOther", { count: club().members.length })}
              </h2>
              <For each={club().members}>
                {(member) => {
                  const isYou = () => member.user?.id === session.data?.id;
                  return (
                    <div class="flex min-h-16 items-center gap-3 rounded-[12px] bg-white/7 px-3 py-2">
                      <Show when={member.user} fallback={<span class="size-10 shrink-0 rounded-full bg-white/15" />}>
                        {(user) => <Avatar class="shrink-0" user={user()} />}
                      </Show>
                      <div class="flex min-w-0 grow flex-col">
                        <span class="truncate text-[17px] font-bold">{member.user?.username}</span>
                        <span class="flex items-center gap-1.5 text-sm text-white/60">
                          <Show when={member.role === "owner"}>
                            <IconCrown class="text-yellow-400" />
                            {t("clubs.detail.roleOwner")}
                          </Show>
                          <Show when={member.role === "admin"}>
                            <IconShield class="text-sky-300" />
                            {t("clubs.detail.roleAdmin")}
                          </Show>
                          <Show when={member.role === "member"}>{t("clubs.detail.roleMember")}</Show>
                        </span>
                      </div>
                      <Show when={!isYou()} fallback={<Tag class="text-[11px]">{t("lobby.you")}</Tag>}>
                        <MemberActions
                          member={member}
                          currentUserRole={currentUserRole()}
                          handlers={{
                            removeMember: handleRemoveMember,
                            transferOwnership: handleTransferOwnership,
                            changeRole: handleChangeRole,
                          }}
                        />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </section>

            <Show when={dialog() === "invite"}>
              <Dialog onClose={() => setDialog(null)} title={t("clubs.detail.inviteMember")}>
                <Dialog.Description>{t("clubs.detail.inviteDescription")}</Dialog.Description>
                <form
                  class="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    inviteForm.handleSubmit();
                  }}
                >
                  <inviteForm.Field name="username">
                    {(field) => (
                      <Input
                        label={t("clubs.detail.username")}
                        name={field().name}
                        value={field().state.value}
                        onBlur={field().handleBlur}
                        onInput={(e) => field().handleChange(e.currentTarget.value)}
                        errorMessage={field().state.meta.errors?.[0]?.message}
                        autofocus
                      />
                    )}
                  </inviteForm.Field>
                  <inviteForm.Subscribe
                    selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
                  >
                    {(state) => (
                      <Button
                        type="submit"
                        intent="gradient"
                        loading={state().isSubmitting || inviteMemberMutation.isPending}
                        disabled={!state().canSubmit}
                      >
                        {t("clubs.detail.invite")}
                      </Button>
                    )}
                  </inviteForm.Subscribe>
                </form>
              </Dialog>
            </Show>

            <Show when={dialog() === "rename"}>
              <Dialog onClose={() => setDialog(null)} title={t("clubs.detail.rename")}>
                <Dialog.Description>{t("clubs.detail.renameDescription")}</Dialog.Description>
                <form
                  class="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    renameForm.handleSubmit();
                  }}
                >
                  <renameForm.Field name="name">
                    {(field) => (
                      <Input
                        label={t("clubs.detail.newName")}
                        name={field().name}
                        value={field().state.value}
                        onBlur={field().handleBlur}
                        onInput={(e) => field().handleChange(e.currentTarget.value)}
                        errorMessage={field().state.meta.errors?.[0]?.message}
                        autofocus
                      />
                    )}
                  </renameForm.Field>
                  <renameForm.Subscribe
                    selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
                  >
                    {(state) => (
                      <Button
                        type="submit"
                        intent="gradient"
                        loading={state().isSubmitting || updateClubMutation.isPending}
                        disabled={!state().canSubmit}
                      >
                        {t("clubs.detail.rename")}
                      </Button>
                    )}
                  </renameForm.Subscribe>
                </form>
              </Dialog>
            </Show>
          </>
        )}
      </Show>
    </main>
  );
}

function canRemoveMember(currentUserRole: string | undefined, targetMemberRole: string): boolean {
  if (!currentUserRole) return false;
  if (currentUserRole === "owner") return targetMemberRole !== "owner";
  if (currentUserRole === "admin") return targetMemberRole !== "owner" && targetMemberRole !== "admin";
  return false;
}
