import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, Show } from "solid-js";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { usdbStore } from "~/stores/usdb";

export const Route = createFileRoute("/settings/usdb")({
  component: UsdbSettingsComponent,
});

function UsdbSettingsComponent() {
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = createSignal(false);

  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/settings" });
  };

  const handleLogin = async () => {
    if (loggingIn()) return;

    const { username, password } = usdbStore.credentials();
    if (!username.trim() || !password) {
      notify({ message: t("settings.sections.usdb.loginFailed"), intent: "error" });
      return;
    }

    setLoggingIn(true);
    try {
      const success = await usdbStore.login();
      if (success) {
        playSound("confirm");
        notify({ message: t("settings.sections.usdb.loggedInAs"), intent: "success" });
      } else {
        notify({ message: t("settings.sections.usdb.loginFailed"), intent: "error" });
      }
    } catch {
      notify({ message: t("settings.sections.usdb.loginFailed"), intent: "error" });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await usdbStore.logout();
    playSound("confirm");
  };

  const menuItems = createMemo((): MenuItem[] => {
    const items: MenuItem[] = [
      {
        type: "input",
        label: t("settings.sections.usdb.username"),
        value: () => usdbStore.credentials().username,
        onInput: (value) => usdbStore.setCredentials(value, usdbStore.credentials().password),
        placeholder: t("settings.sections.usdb.username"),
      },
      {
        type: "input",
        label: t("settings.sections.usdb.password"),
        value: () => usdbStore.credentials().password,
        onInput: (value) => usdbStore.setCredentials(usdbStore.credentials().username, value),
        placeholder: t("settings.sections.usdb.password"),
      },
    ];

    if (usdbStore.loggedIn()) {
      items.push({
        type: "button",
        label: t("settings.sections.usdb.logout"),
        action: handleLogout,
      });
    } else {
      items.push({
        type: "button",
        label: loggingIn() ? t("settings.sections.usdb.loggingIn") : t("settings.sections.usdb.login"),
        action: handleLogin,
      });
    }

    if (usdbStore.catalog().length > 0) {
      items.push({
        type: "button",
        label: `${t("settings.sections.usdb.clearIndex")} (${usdbStore.catalog().length})`,
        action: async () => {
          await usdbStore.clearCatalog();
          playSound("confirm");
          notify({ message: t("settings.sections.usdb.indexCleared"), intent: "success" });
        },
      });
    }

    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={
        <div class="flex items-center justify-between">
          <TitleBar title={t("settings.sections.usdb.title")} onBack={onBack} />
          <div class="flex items-center gap-2 text-sm">
            <Show
              when={usdbStore.loggedIn()}
              fallback={
                <>
                  <div class="h-2 w-2 rounded-full bg-white/30" />
                  <span class="opacity-40">{t("settings.sections.usdb.notLoggedIn")}</span>
                </>
              }
            >
              <div class="h-2 w-2 rounded-full bg-green-400" />
              <span class="opacity-60">{t("settings.sections.usdb.loggedInAs")}</span>
              <Show when={usdbStore.catalog().length > 0}>
                <span class="opacity-40">— {t("online.songsCached", { count: usdbStore.catalog().length })}</span>
              </Show>
            </Show>
          </div>
        </div>
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} />
    </Layout>
  );
}
