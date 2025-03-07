import { type SubmitHandler, createForm, valiForm } from "@modular-forms/solid";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { withQuery } from "ufo";
import * as v from "valibot";
import DiscordLogin from "~/components/discord-login";
import GoogleLogin from "~/components/google-login";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { v1 } from "~/lib/api";
import { locale, t } from "~/lib/i18n";
import { profileQueryOptions } from "~/lib/queries";
import { getEmailSchema, getPasswordSchema } from "~/lib/schemas";
import { notify } from "~/lib/toast";

export default function RegisterPage() {
  return (
    <Show when={locale()} keyed>
      {(_) => {
        const RegisterFormSchema = v.pipe(
          v.object({
            email: getEmailSchema(),
            password: getPasswordSchema(),
            repeatPassword: getPasswordSchema(),
          }),
          v.forward(
            v.partialCheck(
              [["password"], ["repeatPassword"]],
              (input) => input.password === input.repeatPassword,
              t("form.password_mismatch")
            ),
            ["repeatPassword"]
          )
        );
        type RegisterForm = v.InferOutput<typeof RegisterFormSchema>;

        const [registerForm, { Form, Field }] = createForm<RegisterForm>({
          initialValues: {
            email: "",
            password: "",
          },
          validate: valiForm(RegisterFormSchema),
        });

        const navigate = useNavigate();
        const [searchParams] = useSearchParams<{
          redirect?: string;
        }>();
        const queryClient = useQueryClient();

        const handleSubmit: SubmitHandler<RegisterForm> = async (values) => {
          const response = await v1.auth.register.post({ body: values, credentials: "include" });

          if (response.ok) {
            await queryClient.invalidateQueries(profileQueryOptions());
            navigate(searchParams.redirect || "/");
            return;
          }

          notify({
            message: t("error.unknown"),
            intent: "error",
          });
        };

        return (
          <div class="flex flex-grow flex-col items-center justify-center p-2">
            <Card class="flex w-100 max-w-full flex-col gap-4">
              <h1 class="font-semibold text-xl">{t("register.title")}</h1>
              <Form class="flex flex-col gap-4" onSubmit={handleSubmit}>
                <Field name="email">
                  {(field, props) => (
                    <Input autocomplete="email" type="email" label={t("form.email")} {...props} errorMessage={field.error} />
                  )}
                </Field>
                <Field name="password">
                  {(field, props) => (
                    <Input autocomplete="new-password" type="password" label={t("form.password")} {...props} errorMessage={field.error} />
                  )}
                </Field>
                <Field name="repeatPassword">
                  {(field, props) => (
                    <Input
                      autocomplete="new-password"
                      type="password"
                      label={t("form.repeat_password")}
                      {...props}
                      errorMessage={field.error}
                    />
                  )}
                </Field>
                <Button type="submit" class="mt-4" intent="gradient" loading={registerForm.submitting}>
                  {t("register.sign_up")}
                </Button>
              </Form>
              <div class="flex items-center gap-2 text-slate-400">
                <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
                {t("register.or")}
                <div class="h-0.5 flex-1 rounded-full bg-slate-400" />
              </div>

              <div class="flex flex-wrap gap-4">
                <GoogleLogin />
                <DiscordLogin />
              </div>

              <p class="text-slate-500 text-sm">
                {t("register.already_have_an_account")}{" "}
                <a
                  href={withQuery("/sign-in", {
                    redirect: searchParams.redirect,
                  })}
                  class="text-slate-800"
                >
                  {t("register.sign_in")}
                </a>
              </p>
            </Card>
          </div>
        );
      }}
    </Show>
  );
}
