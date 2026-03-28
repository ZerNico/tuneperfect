import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, onMount } from "solid-js";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import Layout from "~/components/layout";
import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import { usdbStore } from "~/stores/usdb";

export const Route = createFileRoute("/sing/online-loading")({
  component: OnlineLoadingComponent,
});

function OnlineLoadingComponent() {
  const navigate = useNavigate();
  const [status, setStatus] = createSignal(t("online.initializing"));

  onMount(async () => {
    // 1. Initialize the store (loads catalog + credentials from disk)
    if (!usdbStore.initialized()) {
      setStatus(t("online.loadingCatalog"));
      await usdbStore.initialize();
    }

    // 2. Login if not already logged in
    if (!usdbStore.loggedIn()) {
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
    if (!p || p.total === 0) return 0;
    return Math.round((p.fetched / p.total) * 100);
  });

  return (
    <Layout>
      <div class="flex grow flex-col items-center justify-center gap-8 p-4">
        <div class="flex items-center justify-center">
          <IconLoaderCircle class="animate-spin text-6xl" />
        </div>

        <div class="w-full max-w-200">
          <div class="mb-2 flex justify-between text-sm">
            <span>{status()}</span>
            <span class="ml-2 shrink-0">
              {usdbStore.syncing() && usdbStore.syncProgress() ? `${progress()}%` : ""}
            </span>
          </div>

          <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              class="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${usdbStore.syncing() ? progress() : 0}%` }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
