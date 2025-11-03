import { safe } from "@orpc/client";
import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { createFileRoute } from "@tanstack/solid-router";
import { joinURL } from "ufo";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_no-auth/verify-email")({
  component: VerifyEmailComponent,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
});

function VerifyEmailComponent() {
  const search = Route.useSearch();

  const form = createForm(() => ({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const absoluteRedirect = search().redirect
        ? joinURL(window.location.origin, search().redirect || "/")
        : window.location.origin;

      const [error, _data] = await safe(
        client.auth.resendVerificationEmail.call({
          email: value.email,
          redirect: absoluteRedirect,
        }),
      );

      if (error) {
        notify({
          message: t("error.unknown"),
          intent: "error",
        });

        return;
      }

      notify({
        message: t("verifyEmail.success"),
        intent: "success",
      });
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        email: v.pipe(v.string(), v.email(t("verifyEmail.emailInvalid"))),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("verifyEmail.title")}</h1>
        <p class="text-slate-500 text-sm">{t("verifyEmail.description")}</p>
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <Input
                label={t("verifyEmail.email")}
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
                <Button type="submit" class="mt-4" intent="gradient" loading={state().isSubmitting}>
                  {t("verifyEmail.resend")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Card>
    </div>
  );
}
