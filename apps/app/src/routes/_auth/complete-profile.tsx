import { safe } from "@orpc/client";
import { createForm } from "@tanstack/solid-form";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
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
      const [error, _data, isDefined] = await safe(
        client.user.updateMe.call({
          username: value.username,
        }),
      );

      if (error) {
        if (isDefined && error.code === "USERNAME_ALREADY_TAKEN") {
          notify({
            message: t("completeProfile.usernameAlreadyTaken"),
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

      await queryClient.invalidateQueries(sessionQueryOptions());
      navigate({ to: search().redirect ?? "/" });
    },
    validators: {
      onChange: v.object({
        username: v.pipe(
          v.string(),
          v.minLength(3, t("completeProfile.usernameMinLength")),
          v.maxLength(20, t("completeProfile.usernameMaxLength")),
          v.regex(/^[a-zA-Z0-9_]+$/, t("completeProfile.usernameInvalid")),
        ),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("completeProfile.title")}</h1>
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
                label={t("completeProfile.username")}
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
                  {t("completeProfile.submit")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Card>
    </div>
  );
}
