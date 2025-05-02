import { safe } from "@orpc/client";
import { createForm } from "@tanstack/solid-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/solid-router";
import { joinURL } from "ufo";
import * as v from "valibot";
import DiscordLogin from "~/components/discord-login";
import GoogleLogin from "~/components/google-login";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_no-auth/sign-in")({
  component: SignInComponent,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
});

function SignInComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const absoluteRedirect = () => (search().redirect ? joinURL(window.location.origin, search().redirect || "/") : window.location.origin);

  const form = createForm(() => ({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data, isDefined] = await safe(
        client.auth.signIn({
          email: value.email,
          password: value.password,
        })
      );

      if (error) {
        if (isDefined) {
          if (error.code === "INVALID_CREDENTIALS") {
            notify({
              message: t("sign_in.invalid_email_or_password"),
              intent: "error",
            });
            return;
          }
          if (error.code === "EMAIL_NOT_VERIFIED") {
            navigate({
              to: "/verify-email",
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

      navigate({ to: search().redirect ?? "/" });
    },
    validators: {
      onChange: v.object({
        email: v.pipe(v.string(), v.email(t("sign_in.email_invalid"))),
        password: v.pipe(v.string(), v.minLength(6, t("sign_in.password_min_length"))),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("sign_in.title")}</h1>
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
          <form.Field name="password">
            {(field) => (
              <Input
                label={t("sign_in.password")}
                name={field().name}
                value={field().state.value}
                onBlur={field().handleBlur}
                onInput={(e) => field().handleChange(e.currentTarget.value)}
                type="password"
                errorMessage={field().state.meta.errors?.[0]?.message}
              />
            )}
          </form.Field>

          <div class="flex items-center justify-between">
            <Link to="/forgot-password" class="text-slate-600 text-sm hover:text-slate-800">
              {t("sign_in.forgot_password")}
            </Link>
          </div>

          <div class="flex flex-col gap-2">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {(state) => (
                <Button type="submit" class="mt-4" intent="gradient" loading={state().isSubmitting}>
                  {t("sign_in.sign_in")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
        <div class="flex items-center gap-2 text-slate-400">
          <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
          {t("sign_in.or")}
          <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
        </div>
        <div class="flex flex-wrap gap-4">
          <DiscordLogin redirect={absoluteRedirect()} />
          <GoogleLogin redirect={absoluteRedirect()} />
        </div>

        <p class="text-slate-500 text-sm">
          {t("sign_in.no_account")}{" "}
          <Link
            to="/sign-up"
            search={{
              redirect: search().redirect,
            }}
            class="text-slate-800"
          >
            {t("sign_in.sign_up")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
