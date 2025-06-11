import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { getMatches } from "@tauri-apps/plugin-cli";
import { createSignal, onMount } from "solid-js";
import * as v from "valibot";
import Layout from "~/components/layout";
import { t } from "~/lib/i18n";
import { tryCatch } from "~/lib/utils/try-catch";
import { songsStore } from "~/stores/songs";
import IconLoaderCircle from "~icons/lucide/loader-circle";

export const Route = createFileRoute("/loading")({
  component: LoadingComponent,
  validateSearch: v.object({
    redirect: v.string(),
  }),
});

function LoadingComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [currentPath, setCurrentPath] = createSignal("");
  const [progress, setProgress] = createSignal(0);

  onMount(async () => {
    const [_error, matches] = await tryCatch(getMatches());

    if (matches?.args.songpath && Array.isArray(matches.args.songpath.value)) {
      await songsStore.updateLocalSongs(matches.args.songpath.value, (path, progress) => {
        setCurrentPath(path);
        setProgress(progress);
      });
    } else {
      await songsStore.updateLocalSongs(songsStore.paths(), (path, progress) => {
        setCurrentPath(path);
        setProgress(progress);
      });
    }

    navigate({
      to: search().redirect,
    });
  });

  return (
    <Layout>
      <div class="flex flex-grow flex-col items-center justify-center gap-8 p-4">
        <div class="flex items-center justify-center">
          <IconLoaderCircle class="animate-spin text-6xl" />
        </div>

        <div class="w-full max-w-lg">
          <div class="mb-2 flex justify-between text-sm">
            <span>{t("loading.parsing")} {currentPath().split("/").pop() || ""}</span>
            <span>{Math.round(progress() * 100)}%</span>
          </div>

          <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              class="h-full rounded-full bg-white"
              style={{ width: `${progress() * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
