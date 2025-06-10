import { safe } from "@orpc/client";
import { createForm } from "@tanstack/solid-form";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import * as v from "valibot";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/change-password")({
  component: ChangePasswordComponent,
});

function ChangePasswordComponent() {
  const navigate = useNavigate();

  const form = createForm(() => ({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data, _isDefined] = await safe(
        client.user.updateMe.call({
          password: value.newPassword,
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
        message: t("changePassword.success"),
        intent: "success",
      });
      navigate({ to: "/edit-profile" });
    },
    validators: {
      onChange: v.pipe(
        v.object({
          newPassword: v.pipe(v.string(), v.minLength(8, t("changePassword.passwordMinLength"))),
          confirmPassword: v.pipe(v.string()),
        }),
        v.forward(
          v.partialCheck(
            [["newPassword"], ["confirmPassword"]],
            (input) => input.newPassword === input.confirmPassword,
            t("changePassword.passwordsDontMatch"),
          ),
          ["confirmPassword"],
        ),
      ),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("changePassword.title")}</h1>
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="newPassword">
            {(field) => (
              <Input
                label={t("changePassword.newPassword")}
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
                label={t("changePassword.confirmPassword")}
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
                <Button type="submit" intent="gradient" loading={state().isSubmitting}>
                  {t("changePassword.save")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Card>
    </div>
  );
}
