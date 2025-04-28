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

export const Route = createFileRoute("/_no-auth/sign-up")({
  component: SignUpComponent,

  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
});

function SignUpComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const form = createForm(() => ({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      const absoluteRedirect = search().redirect ? joinURL(window.location.origin, search().redirect || "/") : window.location.origin;

      const [error, _data, isDefined] = await safe(
        client.auth.signUp({
          email: value.email,
          password: value.password,
          redirect: absoluteRedirect,
        })
      );

      if (error) {
        if (isDefined && error.code === "EMAIL_ALREADY_EXISTS") {
          notify({
            message: t("sign_up.email_already_exists"),
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

      navigate({ to: "/verify-email" });
    },
    validators: {
      onChange: v.pipe(
        v.object({
          email: v.pipe(v.string(), v.email(t("sign_up.email_invalid"))),
          password: v.pipe(v.string(), v.minLength(8, t("sign_up.password_min_length"))),
          confirmPassword: v.pipe(v.string()),
        }),
        v.forward(
          v.partialCheck(
            [["password"], ["confirmPassword"]],
            (input) => input.password === input.confirmPassword,
            t("sign_up.passwords_dont_match")
          ),
          ["confirmPassword"]
        )
      ),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("sign_up.title")}</h1>
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
                label={t("sign_up.email")}
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
                label={t("sign_up.password")}
                name={field().name}
                type="password"
                value={field().state.value}
                onBlur={field().handleBlur}
                onInput={(e) => field().handleChange(e.currentTarget.value)}
                errorMessage={field().state.meta.errors?.[0]?.message}
              />
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <Input
                label={t("sign_up.confirm_password")}
                name={field().name}
                type="password"
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
                  {t("sign_up.sign_up")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
        <div class="flex items-center gap-2 text-slate-400">
          <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
          {t("sign_up.or")}
          <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
        </div>
        <div class="flex flex-wrap gap-4">
          <DiscordLogin redirect={search().redirect} />
          <GoogleLogin redirect={search().redirect} />
        </div>

        <p class="text-slate-500 text-sm">
          {t("sign_up.have_account")}{" "}
          <Link
            to="/sign-in"
            search={{
              redirect: search().redirect,
            }}
            class="text-slate-800"
          >
            {t("sign_up.sign_in")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
