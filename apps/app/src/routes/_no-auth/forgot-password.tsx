import { safe } from "@orpc/client";
import { createForm } from "@tanstack/solid-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_no-auth/forgot-password")({
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const navigate = useNavigate();
  const [sent, setSent] = createSignal(false);

  const form = createForm(() => ({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data] = await safe(
        client.auth.requestPasswordReset({
          email: value.email,
        })
      );

      if (error) {
        notify({
          message: t("error.unknown"),
          intent: "error",
        });
        return;
      }

      setSent(true);
    },
    validators: {
      onChange: v.object({
        email: v.pipe(v.string(), v.email(t("sign_in.email_invalid"))),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("forgot_password.title")}</h1>
        
        {sent() ? (
          <div class="flex flex-col gap-4">
            <p>{t("forgot_password.email_sent")}</p>
            <Button intent="gradient" onClick={() => navigate({ to: "/sign-in" })}>
              {t("common.back_to_sign_in")}
            </Button>
          </div>
        ) : (
          <>
            <p class="text-slate-500">{t("forgot_password.description")}</p>
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
                    label={t("sign_in.email")}
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
                    <Button type="submit" intent="gradient" loading={state().isSubmitting}>
                      {t("forgot_password.send_reset_link")}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </form>
          </>
        )}

        <p class="text-slate-500 text-sm">
          {t("forgot_password.remembered_password")}{" "}
          <Link to="/sign-in" class="text-slate-800">
            {t("common.back_to_sign_in")}
          </Link>
        </p>
      </Card>
    </div>
  );
} 