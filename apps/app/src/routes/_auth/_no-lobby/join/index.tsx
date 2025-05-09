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

export const Route = createFileRoute("/_auth/_no-lobby/join/")({
  component: JoinComponent,
});

function JoinComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = createForm(() => ({
    defaultValues: {
      lobbyCode: "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data, isDefined] = await safe(client.lobby.joinLobby.call({ lobbyId: value.lobbyCode }));

      if (error) {
        if (isDefined && error.code === "NOT_FOUND") {
          notify({
            message: t("join.lobby_not_found"),
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
      await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
      await navigate({ to: "/" });
    },
    validators: {
      onChange: v.object({
        lobbyCode: v.pipe(v.string(), v.minLength(6, t("join.code_min_length")), v.maxLength(8, t("join.code_max_length"))),
      }),
    },
  }));

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("join.title")}</h1>
        <p class="text-slate-500">{t("join.description")}</p>
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="lobbyCode">
            {(field) => (
              <Input
                label={t("join.lobby_code")}
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
                  {t("join.join")}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Card>
    </div>
  );
}
