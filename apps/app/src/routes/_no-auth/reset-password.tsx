import { safe } from "@orpc/client";
import { createForm } from "@tanstack/solid-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_no-auth/reset-password")({
  component: ResetPasswordComponent,
  validateSearch: v.object({
    token: v.optional(v.string()),
    redirect: v.optional(v.string()),
  }),
});

function ResetPasswordComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [success, setSuccess] = createSignal(false);

  const form = createForm(() => ({
    defaultValues: {
      token: search().token || "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        notify({
          message: t("resetPassword.passwordsDontMatch"),
          intent: "error",
        });
        return;
      }

      const [error, _data, isDefined] = await safe(
        client.auth.resetPassword.call({
          token: value.token,
          password: value.password,
        }),
      );

      if (error) {
        if (isDefined) {
          if (error.code === "RESET_TOKEN_NOT_FOUND") {
            notify({
              message: t("resetPassword.invalidOrExpiredToken"),
              intent: "error",
            });
            return;
          }

          if (error.code === "PASSWORD_TOO_SHORT") {
            notify({
              message: t("resetPassword.passwordTooShort"),
              intent: "error",
            });
            return;
          }
        }

        notify({
          message: t("error.unknown"),
          intent: "error",
        });
        return;
      }

      setSuccess(true);

      setTimeout(() => {
        navigate({ to: "/sign-in" });
      }, 3000);
    },
    validators: {
      onChange: v.object({
        token: v.string(),
        password: v.pipe(v.string(), v.minLength(8, t("resetPassword.passwordMinLength"))),
        confirmPassword: v.string(),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("resetPassword.title")}</h1>

        {success() ? (
          <div class="flex flex-col gap-4">
            <p>{t("resetPassword.success")}</p>
            <Button intent="gradient" onClick={() => navigate({ to: "/sign-in" })}>
              {t("common.backToSignIn")}
            </Button>
          </div>
        ) : (
          <>
            <p class="text-slate-500">{t("resetPassword.description")}</p>
            <form
              class="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              {!search().token && (
                <form.Field name="token">
                  {(field) => (
                    <Input
                      label={t("resetPassword.token")}
                      name={field().name}
                      value={field().state.value}
                      onBlur={field().handleBlur}
                      onInput={(e) => field().handleChange(e.currentTarget.value)}
                      errorMessage={field().state.meta.errors?.[0]?.message}
                    />
                  )}
                </form.Field>
              )}

              <form.Field name="password">
                {(field) => (
                  <Input
                    label={t("resetPassword.newPassword")}
                    name={field().name}
                    value={field().state.value}
                    onBlur={field().handleBlur}
                    onInput={(e) => field().handleChange(e.currentTarget.value)}
                    type="password"
                    errorMessage={field().state.meta.errors?.[0]?.message}
                  />
                )}
              </form.Field>

              <form.Field name="confirmPassword">
                {(field) => (
                  <Input
                    label={t("resetPassword.confirmPassword")}
                    name={field().name}
                    value={field().state.value}
                    onBlur={field().handleBlur}
                    onInput={(e) => field().handleChange(e.currentTarget.value)}
                    type="password"
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
                      {t("resetPassword.resetPassword")}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </form>
          </>
        )}

        <p class="text-slate-500 text-sm">
          {t("resetPassword.rememberedPassword")}{" "}
          <Link to="/sign-in" class="text-slate-800">
            {t("common.backToSignIn")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
