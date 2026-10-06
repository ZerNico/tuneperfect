import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";

import PageHeader from "~/components/page-header";
import { SongsStrip, TextExtraField } from "~/components/remote/extras";
import NavPad from "~/components/remote/nav-pad";
import RemotePanel, { Notice } from "~/components/remote/remote-panel";
import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

export const Route = createFileRoute("/_auth/_lobby/_connected/controller")({
  component: ControllerComponent,
});

/** Everything you can do in the game from here: your current move, and the game's buttons with full control. */
function ControllerComponent() {
  const remote = useRemote();
  const fullControl = () => remote.state()?.control === "full";

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col gap-6 px-6 pt-4 pb-8">
      <PageHeader back={{ to: "/", label: t("lobby.title") }} title={t("remote.title")} />

      <Show when={remote.supported()} fallback={<Notice title={t("remote.unsupported")} />}>
        <Show
          when={remote.state()?.panel}
          fallback={
            <Show when={!fullControl()}>
              <Notice title={t("remote.nothing")}>{t("remote.nothingHint")}</Notice>
            </Show>
          }
        >
          {(panel) => <RemotePanel panel={panel()} />}
        </Show>
        <Show when={fullControl()}>
          {/* Where the pad is clumsy, the screen adds a few direct controls above it. */}
          {/* On the song select the search belongs to its strip. */}
          <Show
            when={remote.state()?.extras?.songs}
            fallback={<Show when={remote.state()?.extras?.text}>{(text) => <TextExtraField text={text()} />}</Show>}
          >
            {(songs) => <SongsStrip songs={songs()} text={remote.state()?.extras?.text} />}
          </Show>
          <NavPad />
        </Show>
      </Show>
    </main>
  );
}
