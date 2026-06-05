import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createResource, createSignal, Show, Suspense } from "solid-js";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { commands } from "~/bindings";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import MicLevelMeter from "~/components/mic-level-meter";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { type Microphone, settingsStore } from "~/stores/settings";

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
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.microphones.title")} onBack={onBack} />
      }
      footer={<SettingsFooter />}
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
            const existing = settingsStore.microphones()[id()];
            // Backfill the stable device id for configs saved before IDs existed
            // (or whenever it's missing), so saving without changing the mic still
            // persists the id. Match the stored name against the live devices.
            const initialMicrophone = existing
              ? {
                  ...existing,
                  deviceId:
                    existing.deviceId ?? microphones().find((device) => device.name === existing.name)?.id ?? undefined,
                }
              : {
                  deviceId: microphones()[0]?.id ?? undefined,
                  name: microphones()[0]?.name || null,
                  channel: 0,
                  color: "sky",
                  delay: 200,
                  gain: 1,
                  threshold: 2,
                };

            const [microphone, setMicrophone] = createSignal(initialMicrophone);

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
                  // Persist the stable device id alongside the name so the mic can
                  // still be matched if its name changes or collides.
                  const deviceId = microphones().find((device) => device.name === name)?.id ?? undefined;
                  setMicrophone((prev) => ({ ...prev, name, deviceId }));
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
                type: "custom",
                interactive: false,
                render: () => (
                  <MicLevelMeter
                    deviceId={() => microphone().deviceId}
                    name={() => microphone().name}
                    channel={() => microphone().channel}
                    gain={() => microphone().gain}
                    threshold={() => microphone().threshold}
                  />
                ),
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
