import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import DropdownMenu from "~/components/ui/dropdown-menu";
import Input from "~/components/ui/input";
import { sessionQueryOptions } from "~/lib/auth";
import { useDialog } from "~/lib/dialog";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconCrown from "~icons/lucide/crown";
import IconEdit from "~icons/lucide/edit";
import IconMoreVertical from "~icons/lucide/more-vertical";
import IconSettings from "~icons/lucide/settings";
import IconShield from "~icons/lucide/shield";
import IconShieldMinus from "~icons/lucide/shield-minus";
import IconShieldPlus from "~icons/lucide/shield-plus";
import IconTrash from "~icons/lucide/trash";
import IconUserMinus from "~icons/lucide/user-minus";
import IconUserPlus from "~icons/lucide/user-plus";

export const Route = createFileRoute("/_auth/clubs/$id")({
  component: ClubDetailComponent,
  beforeLoad: async ({ params, context }) => {
    await context.queryClient.prefetchQuery(client.club.getClub.queryOptions({ input: { clubId: params.id } }));
  },
});

type MenuItem = {
  label: string;
  icon: typeof IconCrown;
  onClick: () => void;
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
      onClick: () => handlers.removeMember(userId, username),
      class: "text-red-500",
    });
  }

  if (currentUserRole === "owner") {
    items.push({
      label: t("clubs.detail.transferOwnership"),
      icon: IconCrown,
      onClick: () => handlers.transferOwnership(userId, username),
    });
  }

  if (member.role === "member" && (currentUserRole === "owner" || currentUserRole === "admin")) {
    items.push({
      label: t("clubs.detail.makeAdmin"),
      icon: IconShieldPlus,
      onClick: () => handlers.changeRole(userId, username, "admin"),
    });
  }

  if (member.role === "admin" && currentUserRole === "owner") {
    items.push({
      label: t("clubs.detail.removeAdmin"),
      icon: IconShieldMinus,
      onClick: () => handlers.changeRole(userId, username, "member"),
    });
  }

  return items;
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        navigate({ to: "/clubs" });
      },
    }),
  );

  const removeMemberMutation = useMutation(() =>
    client.club.removeMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clubs", params().id] });
      },
    }),
  );

  const transferOwnershipMutation = useMutation(() =>
    client.club.transferOwnership.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clubs", params().id] });
      },
    }),
  );

  const inviteMemberMutation = useMutation(() =>
    client.club.invite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clubs", params().id] });
        setDialog(null);
      },
    }),
  );

  const changeRoleMutation = useMutation(() =>
    client.club.changeRole.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clubs", params().id] });
      },
    }),
  );

  const leaveClubMutation = useMutation(() =>
    client.club.leaveClub.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: client.club.key() });
        navigate({ to: "/clubs" });
      },
    }),
  );

  const updateClubMutation = useMutation(() =>
    client.club.updateClub.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clubs", params().id] });
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
    });

    if (!confirmed) return;

    deleteClubMutation.mutate({ clubId: params().id });
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.removeMember"),
      description: <p>{t("clubs.detail.removeMemberConfirmation", { username })}</p>,
      intent: "delete",
    });

    if (!confirmed) return;

    removeMemberMutation.mutate({ clubId: params().id, userId });
  };

  const handleTransferOwnership = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.transferOwnership"),
      description: <p>{t("clubs.detail.transferOwnershipConfirmation", { username })}</p>,
      intent: "delete",
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
      intent: "delete",
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
    });

    if (!confirmed) return;

    leaveClubMutation.mutate({ clubId: params().id });
  };

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6">
        <Link to="/clubs" class="flex items-center gap-2 text-slate-300 text-sm transition-colors hover:text-slate-400">
          <IconArrowLeft class="h-4 w-4" /> {t("clubs.detail.backToClubs")}
        </Link>
      </div>

      <Show when={clubQuery.data} fallback={<div>{t("common.loading")}</div>}>
        {(club) => (
          <>
            <header class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <h1 class="font-bold text-3xl">{club().name}</h1>
              <div class="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
                <Show when={currentUserRole() === "owner" || currentUserRole() === "admin"}>
                  <Button intent="gradient" class="w-full md:w-auto" onClick={() => setDialog("invite")}>
                    <IconUserPlus class="mr-2 h-4 w-4" /> {t("clubs.detail.inviteMember")}
                  </Button>
                </Show>
                <DropdownMenu
                  trigger={
                    <DropdownMenu.Trigger class="flex h-10 w-10 shrink-0 transform items-center justify-center rounded-md bg-white text-slate-800 transition-all ease-in-out hover:bg-slate-100 active:scale-95">
                      <IconSettings class="h-5 w-5" />
                    </DropdownMenu.Trigger>
                  }
                >
                  <Show when={currentUserRole() === "owner"}>
                    <DropdownMenu.Item onClick={() => setDialog("rename")}>
                      <IconEdit class="mr-2 h-4 w-4" /> {t("clubs.detail.rename")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item class="text-red-500" onClick={handleDeleteClub}>
                      <IconTrash class="mr-2 h-4 w-4" /> {t("clubs.detail.delete")}
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={currentUserRole() !== "owner"}>
                    <DropdownMenu.Item class="text-red-500" onClick={handleLeaveClub}>
                      <IconUserMinus class="mr-2 h-4 w-4" /> {t("clubs.detail.leave")}
                    </DropdownMenu.Item>
                  </Show>
                </DropdownMenu>
              </div>
            </header>

            <h2 class="mb-4 font-semibold text-xl">{t("clubs.members", { count: club().members.length })}</h2>

            <div class="flex flex-col gap-3">
              <For each={club().members}>
                {(member) => (
                  <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                    <div class="flex items-center gap-4">
                      <Show when={member.user} fallback={<div class="h-10 w-10 rounded-full bg-gray-400" />}>
                        {(user) => <Avatar class="flex-shrink-0" user={user()} />}
                      </Show>
                      <div class="flex items-center gap-2">
                        <div>
                          <div class="font-semibold text-slate-800">{member.user?.username}</div>
                          <div class="flex items-center gap-1.5 text-slate-500 text-sm">
                            <Show when={member.role === "owner"}>
                              <IconCrown class="h-4 w-4 text-yellow-500" />
                              <span>{t("clubs.detail.roleOwner")}</span>
                            </Show>
                            <Show when={member.role === "admin"}>
                              <IconShield class="h-4 w-4" />
                              <span>{t("clubs.detail.roleAdmin")}</span>
                            </Show>
                            <Show when={member.role === "member"}>
                              <span>{t("clubs.detail.roleMember")}</span>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Show when={member.user?.id !== session.data?.id}>
                      {(() => {
                        const menuItems = getMemberMenuItems(member, currentUserRole(), {
                          removeMember: handleRemoveMember,
                          transferOwnership: handleTransferOwnership,
                          changeRole: handleChangeRole,
                        });

                        if (menuItems.length === 0) return null;

                        return (
                          <DropdownMenu
                            trigger={
                              <DropdownMenu.Trigger class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/10">
                                <IconMoreVertical />
                              </DropdownMenu.Trigger>
                            }
                          >
                            <For each={menuItems}>
                              {(item) => (
                                <DropdownMenu.Item class={item.class} onClick={item.onClick}>
                                  <item.icon class="mr-2 h-4 w-4" /> {item.label}
                                </DropdownMenu.Item>
                              )}
                            </For>
                          </DropdownMenu>
                        );
                      })()}
                    </Show>
                  </div>
                )}
              </For>
            </div>

            <Show when={dialog() === "invite"}>
              <Dialog onClose={() => setDialog(null)} title={t("clubs.detail.inviteMember")}>
                <p class="mt-2 text-slate-600 text-sm">{t("clubs.detail.inviteDescription")}</p>
                <form
                  class="mt-4 flex flex-col gap-4"
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
                        loading={state().isSubmitting}
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
                <p class="mt-2 text-slate-600 text-sm">{t("clubs.detail.renameDescription")}</p>
                <form
                  class="mt-4 flex flex-col gap-4"
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
    </div>
  );
}

function canRemoveMember(currentUserRole: string | undefined, targetMemberRole: string): boolean {
  if (!currentUserRole) return false;
  if (currentUserRole === "owner") return targetMemberRole !== "owner";
  if (currentUserRole === "admin") return targetMemberRole !== "owner" && targetMemberRole !== "admin";
  return false;
}
