import { safe } from "@orpc/client";
import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { onMount, Show } from "solid-js";
import { joinURL } from "ufo";
import * as v from "valibot";
import IconCheckCircle from "~icons/ph/check-circle-fill";
import IconMicrophone from "~icons/ph/microphone-stage-fill";

import AuthScreen from "~/components/auth-screen";
import DiscordLogin from "~/components/discord-login";
import GoogleLogin from "~/components/google-login";
import Button from "~/components/ui/button";
import Divider from "~/components/ui/divider";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { queryClient } from "~/main";

export const Route = createFileRoute("/_no-auth/sign-in")({
  component: SignInComponent,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
    error: v.optional(v.string()),
    /** Set by the email verification link, together with the address. The router parses `1` as a number. */
    verified: v.optional(v.pipe(v.unknown(), v.transform(Boolean))),
    email: v.optional(v.string()),
  }),
});

function SignInComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const absoluteRedirect = () =>
    search().redirect ? joinURL(window.location.origin, search().redirect || "/") : window.location.origin;

  // Check for OAuth error on mount
  onMount(() => {
    const message = {
      unverified_email_exists: t("signIn.oauthUnverifiedEmailExists"),
      oauth_cancelled: t("signIn.oauthCancelled"),
      oauth_failed: t("signIn.oauthFailed"),
    }[search().error ?? ""];
    if (message) {
      notify({ message, intent: "error" });
      // Clear the error from URL
      navigate({
        to: "/sign-in",
        search: { redirect: search().redirect },
        replace: true,
      });
    }
  });

  const form = createForm(() => ({
    defaultValues: {
      email: search().email ?? "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data, isDefined] = await safe(
        client.auth.signIn.call({
          email: value.email,
          password: value.password,
        }),
      );

      if (error) {
        if (isDefined) {
          if (error.code === "INVALID_CREDENTIALS") {
            notify({
              message: t("signIn.invalidEmailOrPassword"),
              intent: "error",
            });
            return;
          }
          if (error.code === "EMAIL_NOT_VERIFIED") {
            navigate({
              to: "/verify-email",
              search: { email: value.email, redirect: search().redirect },
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

      await queryClient.resetQueries();
      navigate({ to: search().redirect ?? "/" });
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        email: v.pipe(v.string(), v.email(t("signIn.emailInvalid"))),
        password: v.pipe(v.string(), v.minLength(6, t("signIn.passwordMinLength"))),
      }),
    },
  }));

  return (
    <AuthScreen title={t("signIn.title")} icon={IconMicrophone}>
      <Show when={search().verified}>
        <output class="flex items-center gap-2 rounded-[12px] bg-green-400/15 px-3 py-2.5 font-semibold text-green-200">
          <IconCheckCircle class="shrink-0 text-lg text-green-400" />
          {t("signIn.emailVerified")}
        </output>
      </Show>
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
              label={t("signIn.email")}
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
        <form.Field name="password">
          {(field) => (
            <Input
              label={t("signIn.password")}
              autocomplete="current-password"
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
          <Link to="/forgot-password" class="text-sm text-white/60 hover:text-white">
            {t("signIn.forgotPassword")}
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
                {t("signIn.signIn")}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
      <Divider>{t("signIn.or")}</Divider>
      <div class="flex flex-wrap gap-4">
        <DiscordLogin redirect={absoluteRedirect()} />
        <GoogleLogin redirect={absoluteRedirect()} />
      </div>

      <p class="text-sm text-white/60">
        {t("signIn.noAccount")}{" "}
        <Link
          to="/sign-up"
          search={{
            redirect: search().redirect,
          }}
          class="text-white"
        >
          {t("signIn.signUp")}
        </Link>
      </p>
    </AuthScreen>
  );
}
