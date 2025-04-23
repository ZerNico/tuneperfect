import { createForm } from "@tanstack/solid-form";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { Show, createSignal } from "solid-js";
import * as v from "valibot";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Card from "~/components/ui/card";
import Input from "~/components/ui/input";
import { t } from "~/lib/i18n";
import { sessionQueryOptions } from "~/lib/queries";
import { notify } from "~/lib/toast";
import { isTRPCClientError, trpc } from "~/lib/trpc";
import IconPencilLine from "~icons/lucide/pencil-line";

export const Route = createFileRoute("/_auth/edit-profile")({
  component: EditProfileComponent,
});

function EditProfileComponent() {
  const queryClient = useQueryClient();
  const [fileInputElement, setFileInputElement] = createSignal<HTMLInputElement | null>(null);
  const [file, setFile] = createSignal<File | null>(null);
  const sessionQuery = createQuery(() => sessionQueryOptions());

  const form = createForm(() => ({
    defaultValues: {
      username: sessionQuery.data?.user.username ?? "",
    },
    onSubmit: async ({ value }) => {
      try {
        const f = file();
        if (f) {
          const formData = new FormData();
          formData.append("image", f);

          await trpc.user.updateImage.mutate(formData);
        }
        await trpc.user.update.mutate({
          username: value.username,
        });

        await queryClient.invalidateQueries(sessionQueryOptions());
        notify({
          message: t("edit_profile.success"),
          intent: "success",
        });
        setFile(null);
      } catch (error) {
        if (isTRPCClientError(error)) {
          if (error.data?.code === "BAD_REQUEST" && error.data?.valibotError) {
            const errorMessage = error.data.valibotError.root?.[0] ?? t("error.unknown");
            notify({
              message: errorMessage,
              intent: "error",
            });
            return;
          }
        }
        notify({
          message: t("error.unknown"),
          intent: "error",
        });
      }
    },
    validators: {
      onChange: v.object({
        username: v.pipe(
          v.string(),
          v.minLength(3, t("edit_profile.username_min_length")),
          v.maxLength(20, t("edit_profile.username_max_length")),
          v.regex(/^[a-zA-Z0-9_]+$/, t("edit_profile.username_invalid"))
        ),
      }),
    },
  }));

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setFile(() => file);
  };

  const fileUrl = () => {
    const f = file();
    if (!f) return;
    return URL.createObjectURL(f);
  };

  return (
    <div class="flex flex-grow flex-col items-center justify-center p-2">
      <Card class="flex w-100 max-w-full flex-col gap-4">
        <h1 class="font-semibold text-xl">{t("edit_profile.title")}</h1>
        <div class="flex justify-center">
          <button class="relative transition-opacity hover:opacity-75" type="button" onClick={() => fileInputElement()?.click()}>
            <input
              ref={setFileInputElement}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileChange}
              class="hidden"
            />
            <Show when={file()} fallback={<Avatar class="h-30 w-30" user={form.state.values} />}>
              <img src={fileUrl()} alt="" class="h-30 w-30 rounded-full" />
            </Show>
            <div class="absolute right-1 bottom-1 rounded-full bg-slate-800 p-1.5 text-white text-xs">
              <IconPencilLine />
            </div>
          </button>
        </div>
        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="username">
            {(field) => (
              <Input
                label={t("edit_profile.username")}
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
                  {t("edit_profile.save")}
                </Button>
              )}
            </form.Subscribe>
            <Button to="/edit-profile/password" type="button">
              {t("edit_profile.change_password")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
