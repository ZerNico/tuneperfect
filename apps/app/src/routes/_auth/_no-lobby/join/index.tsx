import { safe } from "@orpc/client";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import IconQrCode from "~icons/ph/qr-code-bold";

import CodeInput, { LOBBY_CODE_LENGTH } from "~/components/code-input";
import PageHeader from "~/components/page-header";
import QrScanDialog from "~/components/qr-scan-dialog";
import Button from "~/components/ui/button";
import Divider from "~/components/ui/divider";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";

export const Route = createFileRoute("/_auth/_no-lobby/join/")({
  component: JoinComponent,
});

function JoinComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [code, setCode] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [joining, setJoining] = createSignal(false);
  const [scanning, setScanning] = createSignal(false);

  const join = async (lobbyCode: string) => {
    if (joining()) return;
    if (lobbyCode.length !== LOBBY_CODE_LENGTH) {
      setError(t("join.codeLength"));
      return;
    }

    setJoining(true);
    setError(undefined);
    const [joinError, _data, isDefined] = await safe(client.lobby.joinLobby.call({ lobbyId: lobbyCode }));
    setJoining(false);

    if (joinError) {
      setError(isDefined && joinError.code === "NOT_FOUND" ? t("join.lobbyNotFound") : t("error.unknown"));
      return;
    }

    await queryClient.invalidateQueries(sessionQueryOptions());
    await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
    await navigate({ to: "/" });
  };

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4">
      <PageHeader title={t("join.title")} subtitle={t("join.description")} />

      <form
        class="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void join(code());
        }}
      >
        <CodeInput
          label={t("join.lobbyCode")}
          value={code()}
          onInput={(value) => {
            setCode(value);
            setError(undefined);
          }}
          onComplete={(value) => void join(value)}
          invalid={!!error()}
          disabled={joining()}
          autofocus
        />
        <Show when={error()}>
          <p class="text-sm font-semibold text-red-300" role="alert">
            {error()}
          </p>
        </Show>
        <Button type="submit" intent="gradient" class="mt-2 w-full" loading={joining()}>
          {t("join.join")}
        </Button>
      </form>

      <Divider class="my-6">{t("join.or")}</Divider>

      <Button class="w-full" onClick={() => setScanning(true)}>
        <IconQrCode class="text-xl" />
        {t("join.scan")}
      </Button>

      <Show when={scanning()}>
        <QrScanDialog
          onClose={() => setScanning(false)}
          onCode={(scanned) => {
            setScanning(false);
            setCode(scanned);
            void join(scanned);
          }}
        />
      </Show>
    </main>
  );
}
