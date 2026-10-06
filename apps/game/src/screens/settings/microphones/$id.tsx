import { useNavigate, getRouteApi } from "@tanstack/solid-router";
import { createResource, createSignal, Show, Suspense } from "solid-js";
import IconLoaderCircle from "~icons/ph/spinner-gap-bold";

import Layout from "~/components/layout";
import Menu, { select, type MenuItem } from "~/components/menu";
import MicLevelMeter from "~/components/mic-level-meter";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import { notify } from "~/lib/toast";
import { getColorVar } from "~/lib/utils/color";
import { type Microphone, settingsStore } from "~/stores/settings";

const route = getRouteApi("/settings/microphones/$id");

export default function MicrophoneScreen() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings/microphones" });
  };
  const [microphones] = createResource(async () => {
    try {
      return await native.microphones.list();
    } catch (error) {
      console.error("Failed to list microphones:", error);
      return [];
    }
  });

  const params = route.useParams();
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
                notify({ message: t("settings.sections.microphones.noDevice"), intent: "error" });
                return;
              }
              // Two slots on one input would score the same voice twice.
              const taken = settingsStore
                .microphones()
                .findIndex((other, index) => index !== id() && other.channel === mic.channel && sameDevice(other, mic));
              if (taken !== -1) {
                notify({
                  message: t("settings.sections.microphones.alreadyUsed", { number: taken + 1 }),
                  intent: "error",
                });
                return;
              }
              settingsStore.saveMicrophone(id(), mic);
              onBack();
            };

            // Devices by id (names can repeat, e.g. two of the same USB mic); devices without an id
            // fall back to their name.
            const deviceKey = (device: { id?: string | null; name: string }) => device.id ?? `name:${device.name}`;
            const deviceByKey = (key: string) => microphones().find((device) => deviceKey(device) === key);
            const deviceLabel = (key: string) => {
              const device = deviceByKey(key);
              if (!device) return microphone().name ?? "?";
              const twins = microphones().filter((other) => other.name === device.name);
              return twins.length > 1 ? `${device.name} (${twins.indexOf(device) + 1})` : device.name;
            };
            const selectedDevice = () => {
              const mic = microphone();
              return mic.deviceId
                ? deviceByKey(mic.deviceId)
                : microphones().find((device) => device.name === mic.name);
            };

            const menuItems: MenuItem[] = [
              select({
                label: t("settings.sections.microphones.microphone"),
                value: () => {
                  const device = selectedDevice();
                  return device ? deviceKey(device) : null;
                },
                onChange: (key: string) => {
                  const device = deviceByKey(key);
                  if (!device) return;
                  // Persist the stable device id alongside the name so the mic can
                  // still be matched if its name changes or collides.
                  setMicrophone((prev) => ({
                    ...prev,
                    name: device.name,
                    deviceId: device.id ?? undefined,
                    channel: Math.min(prev.channel, Math.max(device.channels, 1) - 1),
                  }));
                },
                options: microphones().map(deviceKey),
                renderValue: (key: string | null) => <span>{key !== null ? deviceLabel(key) : "?"}</span>,
              }),
              select({
                label: t("settings.sections.microphones.channel"),
                value: () => microphone().channel,
                onChange: (channel: number) => {
                  setMicrophone((prev) => ({ ...prev, channel }));
                },
                renderValue: (channel: number | null) => <span>{channel !== null ? `${channel + 1}` : "?"}</span>,
                // The device's own inputs; 8 when it's unknown (e.g. the saved device is unplugged).
                options: () => Array.from({ length: selectedDevice()?.channels || 8 }, (_, channel) => channel),
              }),
              select({
                label: t("settings.sections.microphones.color"),
                value: () => microphone().color,
                onChange: (color: string) => {
                  setMicrophone((prev) => ({ ...prev, color }));
                },
                options: ["sky", "red", "blue", "green", "pink", "purple", "yellow", "orange"],
                renderValue: (color: string | null) => (
                  <div
                    class="h-8 w-8 rounded-full border-[0.2cqw] border-white"
                    style={{ background: color ? getColorVar(color, 500) : "transparent" }}
                  />
                ),
              }),
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
              // A new microphone isn't saved yet, so there's nothing to delete.
              ...(existing
                ? [
                    {
                      type: "button",
                      label: t("settings.delete"),
                      action: deleteMicrophone,
                    } satisfies MenuItem,
                  ]
                : []),
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

/** Whether two microphone settings use the same input device (by id when both have one). */
function sameDevice(a: { deviceId?: string; name: string }, b: { deviceId?: string; name: string }) {
  return a.deviceId && b.deviceId ? a.deviceId === b.deviceId : a.name === b.name;
}

type NullablePartial<T> = { [P in keyof T]?: T[P] | null };
function isValidMicrophone(microphone: NullablePartial<Microphone>): microphone is Microphone {
  return microphone.name !== null && microphone.name !== undefined;
}
