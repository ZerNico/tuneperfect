import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/clubs/create")({
  component: ClubCreateComponent,
});

function ClubCreateComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createClubMutation = useMutation(() => ({
    mutationFn: async (data: { name: string }) =>
      await client.club.createClub.call({
        name: data.name,
      }),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ["club"] });
      notify({
        message: t("clubs.created"),
        intent: "success",
      });
      navigate({ to: "/clubs/$id", params: { id: club.clubId } });
    },
  }));

  const form = createForm(() => ({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      createClubMutation.mutate(value);
    },
    validators: {
      onChange: v.object({
        name: v.pipe(
          v.string(),
          v.minLength(3, t("editProfile.usernameMinLength")),
          v.maxLength(30, t("editProfile.usernameMaxLength"))
        ),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("clubs.create")}</h1>

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
              />
            )}
          </form.Field>

          <div class="flex flex-col gap-2">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {(state) => (
                <Button type="submit" class="mt-4" intent="gradient" loading={state().isSubmitting || createClubMutation.isPending}>
                  {t("clubs.create")}
                </Button>
              )}
            </form.Subscribe>
            <Button type="button" onClick={() => navigate({ to: "/clubs" })}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
