import { createForm } from "@tanstack/solid-form";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { authClient } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { sessionQueryOptions } from "~/lib/queries";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/complete-profile")({
  component: RouteComponent,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = createForm(() => ({
    defaultValues: {
      username: "",
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.updateUser({
        username: value.username,
      });

      queryClient.invalidateQueries(sessionQueryOptions());

      if (error) {
        if (error.code === "USERNAME_IS_ALREADY_TAKEN") {
          notify({
            message: t("complete_profile.username_already_taken"),
            intent: "error",
          });
          return;
        }
        notify({
          message: t("error.unknown"),
          intent: "error",
        });
        return;
      }

      navigate({ to: search().redirect ?? "/" });
    },
    validators: {
      onChange: v.object({
        username: v.pipe(
          v.string(),
          v.minLength(3, t("complete_profile.username_min_length")),
          v.maxLength(20, t("complete_profile.username_max_length")),
          v.regex(/^[a-zA-Z0-9_]+$/, t("complete_profile.username_invalid"))
        ),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("complete_profile.title")}</h1>
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="username">
            {(field) => (
              <Input
                label={t("complete_profile.username")}
                name={field().name}
                value={field().state.value}
                onBlur={field().handleBlur}
                onInput={(e) => field().handleChange(e.currentTarget.value)}
                errorMessage={field().state.meta.errors?.[0]?.message}
                autofocus
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
                <Button type="submit" class="mt-4" intent="gradient" loading={state().isSubmitting}>
                  {t("complete_profile.submit")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Card>
    </div>
  );
}
