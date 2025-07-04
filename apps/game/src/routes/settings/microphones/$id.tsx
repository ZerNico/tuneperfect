import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createResource, createSignal, Show, Suspense } from "solid-js";
import { commands } from "~/bindings";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { type Microphone, settingsStore } from "~/stores/settings";
import IconLoaderCircle from "~icons/lucide/loader-circle";

export const Route = createFileRoute("/settings/microphones/$id")({
  component: MicrophoneComponent,
});

function MicrophoneComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings/microphones" });
  };
  const [microphones] = createResource(async () => {
    const response = await commands.getMicrophones();
    if (response.status === "ok") {
      return response.data;
    }

    return [];
  });

  const params = Route.useParams();
  const id = () => {
    const id = Number.parseInt(params().id, 10);
    return Number.isNaN(id) ? -1 : id;
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} description={t("settings.sections.microphones.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Suspense
        fallback={
          <div class="flex h-screen w-screen items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
          </div>
        }
      >
        <Show when={microphones()}>
          {(microphones) => {
            const [microphone, setMicrophone] = createSignal(
              settingsStore.microphones()[id()] || {
                name: microphones()[0]?.name || null,
                channel: 1,
                color: "sky",
                delay: 200,
                gain: 1,
                threshold: 2,
              }
            );

            const deleteMicrophone = () => {
              settingsStore.deleteMicrophone(id());
              onBack();
            };

            const saveMicrophone = () => {
              const mic = microphone();
              if (!isValidMicrophone(mic)) {
                return;
              }
              settingsStore.saveMicrophone(id(), mic);
              onBack();
            };

            const menuItems: MenuItem[] = [
              {
                type: "select-string",
                label: t("settings.sections.microphones.microphone"),
                value: () => microphone().name,
                onChange: (name: string) => {
                  setMicrophone((prev) => ({ ...prev, name }));
                },
                options: microphones().map((microphone) => microphone.name),
              },
              {
                type: "select-number",
                label: t("settings.sections.microphones.channel"),
                value: () => microphone().channel,
                onChange: (channel: number) => {
                  setMicrophone((prev) => ({ ...prev, channel }));
                },
                renderValue: (channel: number | null) => <span>{channel !== null ? `${channel + 1}` : "?"}</span>,
                options: [0, 1, 2, 3, 4, 5, 6, 7],
              },
              {
                type: "select-string",
                label: t("settings.sections.microphones.color"),
                value: () => microphone().color,
                onChange: (color: string) => {
                  setMicrophone((prev) => ({ ...prev, color }));
                },
                options: ["sky", "red", "blue", "green", "pink", "purple", "yellow", "orange"],
                renderValue: (color: string | null) => (
                  <div
                    class="h-8 w-8 rounded-full border-[0.2cqw] border-white"
                    style={{ background: color ? `var(--color-${color}-500)` : "transparent" }}
                  />
                ),
              },
              {
                type: "slider",
                label: t("settings.sections.microphones.delay"),
                value: () => microphone().delay,
                min: 0,
                max: 500,
                step: 10,
                onInput: (delay: number) => {
                  setMicrophone((prev) => ({ ...prev, delay }));
                },
              },
              {
                type: "slider",
                label: t("settings.sections.microphones.gain"),
                value: () => microphone().gain,
                min: 0,
                max: 3,
                step: 0.1,
                onInput: (gain: number) => {
                  setMicrophone((prev) => ({ ...prev, gain }));
                },
              },
              {
                type: "slider",
                label: t("settings.sections.microphones.threshold"),
                value: () => microphone().threshold,
                min: 0,
                max: 5,
                step: 0.1,
                onInput: (threshold: number) => {
                  setMicrophone((prev) => ({ ...prev, threshold }));
                },
              },
              {
                type: "button",
                label: t("settings.delete"),
                action: deleteMicrophone,
              },
              {
                type: "button",
                label: t("settings.save"),
                action: saveMicrophone,
              },
            ];

            return <Menu items={menuItems} onBack={onBack} />;
          }}
        </Show>
      </Suspense>
    </Layout>
  );
}

type NullablePartial<T> = { [P in keyof T]?: T[P] | null };
function isValidMicrophone(microphone: NullablePartial<Microphone>): microphone is Microphone {
  return microphone.name !== null && microphone.name !== undefined;
}
