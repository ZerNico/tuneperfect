import { safe } from "@orpc/client";
import { createForm, revalidateLogic } from "@tanstack/solid-form";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import * as v from "valibot";
import IconCaretRight from "~icons/ph/caret-right-bold";
import IconLockKey from "~icons/ph/lock-key-bold";
import IconPencil from "~icons/ph/pencil-simple-bold";
import IconSignOut from "~icons/ph/sign-out-bold";

import PageHeader from "~/components/page-header";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Dialog from "~/components/ui/dialog";
import ImageCrop from "~/components/ui/image-crop";
import Input from "~/components/ui/input";
import { useSignOut } from "~/hooks/use-sign-out";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

export const Route = createFileRoute("/_auth/edit-profile")({
  component: EditProfileComponent,
});

function EditProfileComponent() {
  const queryClient = useQueryClient();
  const [fileInputElement, setFileInputElement] = createSignal<HTMLInputElement | null>(null);
  const [file, setFile] = createSignal<File | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = createSignal(false);
  const [tempImageUrl, setTempImageUrl] = createSignal<string | null>(null);
  const sessionQuery = useQuery(() => sessionQueryOptions());
  const signOut = useSignOut();

  const form = createForm(() => ({
    defaultValues: {
      username: sessionQuery.data?.username ?? "",
    },
    onSubmit: async ({ value }) => {
      const [error, _data, isDefined] = await safe(
        client.user.updateMe.call({
          username: value.username,
          imageFile: file() ?? undefined,
        }),
      );

      if (error) {
        if (isDefined && error.code === "USERNAME_ALREADY_TAKEN") {
          notify({
            message: t("editProfile.usernameAlreadyTaken"),
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
      notify({
        message: t("editProfile.success"),
        intent: "success",
      });
      setFile(null);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        username: v.pipe(
          v.string(),
          v.minLength(3, t("editProfile.usernameMinLength")),
          v.maxLength(20, t("editProfile.usernameMaxLength")),
          v.regex(/^[a-zA-Z0-9_]+$/, t("editProfile.usernameInvalid")),
        ),
      }),
    },
  }));

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      notify({
        message: t("editProfile.invalidFileType"),
        intent: "error",
      });
      return;
    }

    const tempUrl = URL.createObjectURL(selectedFile);
    setTempImageUrl(tempUrl);
    setCropDialogOpen(true);

    input.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], "avatar.webp", {
      type: "image/webp",
    });

    setFile(croppedFile);

    const tempUrl = tempImageUrl();
    if (tempUrl) {
      URL.revokeObjectURL(tempUrl);
      setTempImageUrl(null);
    }

    setCropDialogOpen(false);
  };

  const handleCropCancel = () => {
    setCropDialogOpen(false);

    const tempUrl = tempImageUrl();
    if (tempUrl) {
      URL.revokeObjectURL(tempUrl);
      setTempImageUrl(null);
    }
  };

  const fileUrl = createMemo(() => {
    const f = file();
    if (!f) return;
    const url = URL.createObjectURL(f);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4 pb-8">
      <PageHeader title={t("editProfile.title")} subtitle={sessionQuery.data?.email} />

      <div class="flex justify-center pb-6">
        <button
          class="relative cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          type="button"
          aria-label={t("editProfile.changePicture")}
          onClick={() => fileInputElement()?.click()}
        >
          <input
            ref={setFileInputElement}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            aria-hidden="true"
            tabIndex={-1}
            class="hidden"
          />
          <Show
            when={file()}
            fallback={<Show when={sessionQuery.data}>{(session) => <Avatar size="lg" user={session()} />}</Show>}
          >
            <img src={fileUrl()} alt="" class="h-30 w-30 rounded-full object-cover" />
          </Show>
          <span class="gradient-accent absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-full text-lg">
            <IconPencil />
          </span>
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
              label={t("editProfile.username")}
              autocomplete="username"
              name={field().name}
              value={field().state.value}
              onBlur={field().handleBlur}
              onInput={(e) => field().handleChange(e.currentTarget.value)}
              errorMessage={field().state.meta.errors?.[0]?.message}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
          {(state) => (
            <Button type="submit" intent="gradient" loading={state().isSubmitting}>
              {t("editProfile.save")}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <section class="mt-8 flex flex-col gap-2">
        <h2 class="text-xs font-black tracking-[0.2em] text-white/50 uppercase">{t("editProfile.account")}</h2>
        <Link
          to="/change-password"
          class="flex min-h-14 items-center gap-3 rounded-[12px] bg-white/7 px-4 font-bold transition-colors hover:bg-white/10"
        >
          <IconLockKey class="text-xl text-white/60" />
          <span class="grow">{t("editProfile.changePassword")}</span>
          <IconCaretRight class="text-white/40" />
        </Link>
        <button
          type="button"
          class="flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] bg-white/7 px-4 text-start font-bold text-red-300 transition-colors hover:bg-red-400/10"
          onClick={() => void signOut()}
        >
          <IconSignOut class="text-xl" />
          {t("editProfile.signOut")}
        </button>
      </section>

      <Show when={cropDialogOpen() && tempImageUrl()}>
        {(imageUrl) => (
          <Dialog onClose={handleCropCancel} title={t("editProfile.cropImage")}>
            <ImageCrop
              imageUrl={imageUrl()}
              onCrop={handleCropComplete}
              onCancel={handleCropCancel}
              resolution={1024}
            />
          </Dialog>
        )}
      </Show>
    </main>
  );
}
