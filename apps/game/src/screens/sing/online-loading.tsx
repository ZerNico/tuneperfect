import { useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, onMount } from "solid-js";

import Layout from "~/components/layout";
import LoadingPanel from "~/components/loading-panel";
import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import { usdbStore } from "~/stores/usdb";

export default function OnlineLoadingScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = createSignal(t("online.initializing"));

  onMount(async () => {
    // 1. Initialize the store (loads catalog + credentials from disk)
    if (!usdbStore.initialized()) {
      setStatus(t("online.loadingCatalog"));
      await usdbStore.initialize();
    }

    // 2. Establish a session for this process (cookies reset every launch).
    if (!usdbStore.sessionActive()) {
      const { username, password } = usdbStore.credentials();
      if (!username || !password) {
        notify({ message: t("online.loginRequired"), intent: "error" });
        navigate({ to: "/sing" });
        return;
      }

      setStatus(t("online.loggingIn"));
      const success = await usdbStore.login();
      if (!success) {
        notify({ message: t("settings.sections.usdb.loginFailed"), intent: "error" });
        navigate({ to: "/sing" });
        return;
      }
    }

    // 3. Sync catalog if needed
    if (usdbStore.catalog().length === 0) {
      setStatus(t("online.syncing"));
      await usdbStore.syncCatalog();
    } else {
      // Incremental sync in background — don't block navigation
      usdbStore.syncCatalog();
    }

    navigate({ to: "/sing/online", replace: true });
  });

  const progress = createMemo(() => {
    const p = usdbStore.syncProgress();
    if (!usdbStore.syncing() || !p || p.total === 0) return null;
    return (p.fetched / p.total) * 100;
  });

  return (
    <Layout>
      <div class="flex grow items-center justify-center p-4">
        <LoadingPanel
          title={t("online.title")}
          progress={progress()}
          detail={status()}
          fill="gradient-sing bg-linear-to-r"
        />
      </div>
    </Layout>
  );
}
