import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { For, Show, createSignal } from "solid-js";
import * as v from "valibot";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Dialog from "~/components/ui/dialog";
import DropdownMenu from "~/components/ui/dropdown-menu";
import Input from "~/components/ui/input";
import { sessionQueryOptions } from "~/lib/auth";
import { useDialog } from "~/lib/dialog";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import IconCrown from "~icons/lucide/crown";
import IconMoreVertical from "~icons/lucide/more-vertical";
import IconSettings from "~icons/lucide/settings";
import IconShield from "~icons/lucide/shield";
import IconShieldCheck from "~icons/lucide/shield-check";
import IconShieldOff from "~icons/lucide/shield-off";
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
  icon: typeof IconCrown | typeof IconUserMinus | typeof IconShieldCheck | typeof IconShieldOff;
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
  }
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
      icon: IconShieldCheck,
      onClick: () => handlers.changeRole(userId, username, "admin"),
    });
  }

  if (member.role === "admin" && currentUserRole === "owner") {
    items.push({
      label: t("clubs.detail.removeAdmin"),
      icon: IconShieldOff,
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
    queryKey: ["clubs", params().id],
    queryFn: () => client.club.getClub.call({ clubId: params().id }),
  }));

  const deleteClubMutation = useMutation(() => ({
    mutationFn: async () => {
      return client.club.deleteClub.call({ clubId: params().id });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      navigate({ to: "/clubs" });
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const removeMemberMutation = useMutation(() => ({
    mutationFn: async (userId: string) => {
      return client.club.removeMember.call({ clubId: params().id, userId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      notify({
        intent: "success",
        message: t("clubs.detail.memberRemoved"),
      });
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const transferOwnershipMutation = useMutation(() => ({
    mutationFn: async (userId: string) => {
      return client.club.transferOwnership.call({ clubId: params().id, userId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      notify({
        intent: "success",
        message: t("clubs.detail.ownershipTransferred"),
      });
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const inviteMemberMutation = useMutation(() => ({
    mutationFn: async (username: string) => {
      return client.club.invite.call({ clubId: params().id, username });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      notify({
        intent: "success",
        message: t("clubs.detail.memberInvited"),
      });
      setDialog(null);
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const changeRoleMutation = useMutation(() => ({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "member" }) => {
      return client.club.changeRole.call({ clubId: params().id, userId, role });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      notify({
        intent: "success",
        message: t("clubs.detail.roleChanged"),
      });
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const leaveClubMutation = useMutation(() => ({
    mutationFn: async () => {
      return client.club.leaveClub.call({ clubId: params().id });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubs"] }),
        queryClient.invalidateQueries(client.club.getUserClubs.queryOptions()),
        queryClient.invalidateQueries(client.club.getUserInvites.queryOptions()),
      ]);
      navigate({ to: "/clubs" });
      notify({
        intent: "success",
        message: t("clubs.detail.leftClub"),
      });
    },
    onError: () => {
      notify({
        intent: "error",
        message: t("error.unknown"),
      });
    },
  }));

  const inviteForm = createForm(() => ({
    defaultValues: {
      username: "",
    },
    onSubmit: async ({ value }) => {
      inviteMemberMutation.mutate(value.username);
    },
    validators: {
      onChange: v.object({
        username: v.pipe(v.string(), v.minLength(1, t("clubs.detail.usernameRequired"))),
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

    deleteClubMutation.mutate();
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.removeMember"),
      description: <p>{t("clubs.detail.removeMemberConfirmation", { username })}</p>,
      intent: "delete",
    });

    if (!confirmed) return;

    removeMemberMutation.mutate(userId);
  };

  const handleTransferOwnership = async (userId: string, username: string) => {
    const confirmed = await showDialog({
      title: t("clubs.detail.transferOwnership"),
      description: <p>{t("clubs.detail.transferOwnershipConfirmation", { username })}</p>,
      intent: "delete",
    });

    if (!confirmed) return;

    transferOwnershipMutation.mutate(userId);
  };

  const handleChangeRole = async (userId: string, username: string, newRole: "admin" | "member") => {
    const confirmed = await showDialog({
      title: t("clubs.detail.changeRole"),
      description: <p>{t("clubs.detail.changeRoleConfirmation", { username, role: newRole })}</p>,
      intent: "delete",
    });

    if (!confirmed) return;

    changeRoleMutation.mutate({ userId, role: newRole });
  };

  const [dialog, setDialog] = createSignal<"invite" | null>(null);

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

    leaveClubMutation.mutate();
  };

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Show when={clubQuery.data}>
        {(club) => (
          <>
            <Card class="flex w-150 max-w-full flex-col gap-4">
              <div class="flex items-center justify-between">
                <h1 class="font-semibold text-xl">{club().name}</h1>
                <DropdownMenu
                  trigger={
                    <DropdownMenu.Trigger class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/10">
                      <IconSettings />
                    </DropdownMenu.Trigger>
                  }
                >
                  <Show when={currentUserRole() === "owner"}>
                    <DropdownMenu.Item class="text-red-500" onClick={handleDeleteClub}>
                      <IconTrash /> {t("clubs.detail.delete")}
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={currentUserRole() !== "owner"}>
                    <DropdownMenu.Item class="text-red-500" onClick={handleLeaveClub}>
                      <IconUserMinus /> {t("clubs.detail.leave")}
                    </DropdownMenu.Item>
                  </Show>
                </DropdownMenu>
              </div>
              <div class="flex flex-col gap-2">
                <For each={club().members}>
                  {(member) => (
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <Avatar user={member.user} />
                        <div class="flex items-center gap-1">
                          <span>{member.user?.username}</span>
                          <Show when={member.role === "owner"}>
                            <IconCrown class="text-yellow-500" />
                          </Show>
                          <Show when={member.role === "admin"}>
                            <IconShield />
                          </Show>
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
                                    <item.icon /> {item.label}
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
              <Show when={currentUserRole() === "owner" || currentUserRole() === "admin"}>
                <div class="flex items-center justify-center">
                  <Button intent="gradient" class="w-full max-w-70" onClick={() => setDialog("invite")}>
                    {t("clubs.detail.invite")}
                    <IconUserPlus />
                  </Button>
                </div>
              </Show>
            </Card>
            <Show when={dialog() === "invite"}>
              <Dialog onClose={() => setDialog(null)} title={t("clubs.detail.invite")}>
                <Dialog.Description>
                  <p>{t("clubs.detail.inviteDescription")}</p>
                </Dialog.Description>
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
                      />
                    )}
                  </inviteForm.Field>
                  <div class="flex flex-col gap-2">
                    <inviteForm.Subscribe
                      selector={(state) => ({
                        canSubmit: state.canSubmit,
                        isSubmitting: state.isSubmitting,
                      })}
                    >
                      {(state) => (
                        <Button type="submit" intent="gradient" loading={state().isSubmitting}>
                          {t("clubs.detail.invite")}
                        </Button>
                      )}
                    </inviteForm.Subscribe>
                  </div>
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
  return currentUserRole === "owner" || (currentUserRole === "admin" && targetMemberRole !== "owner");
}
