import { safe } from "@orpc/client";
import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import * as v from "valibot";
import IconEnvelope from "~icons/ph/envelope-simple-fill";

import AuthScreen from "~/components/auth-screen";
import Button from "~/components/ui/button";
import Input from "~/components/ui/input";
import { emailVerifiedUrl } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_no-auth/verify-email")({
  component: VerifyEmailComponent,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
    /** The address the link went to, when we know it (after sign-up or sign-in). */
    email: v.optional(v.string()),
  }),
});

function VerifyEmailComponent() {
  const search = Route.useSearch();

  const form = createForm(() => ({
    defaultValues: {
      email: search().email ?? "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data] = await safe(
        client.auth.resendVerificationEmail.call({
          email: value.email,
          redirect: emailVerifiedUrl(value.email, search().redirect),
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
    <AuthScreen
      title={t("verifyEmail.title")}
      icon={IconEnvelope}
      subtitle={
        <Show when={search().email} fallback={t("verifyEmail.description")}>
          {(email) => (
            <>
              {t("verifyEmail.sentTo")} <strong class="font-bold text-white">{email()}</strong>.{" "}
              {t("verifyEmail.sentToHint")}
            </>
          )}
        </Show>
      }
    >
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
              type="email"
              autocomplete="email"
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
    </AuthScreen>
  );
}
