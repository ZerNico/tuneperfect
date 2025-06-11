import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { getMatches } from "@tauri-apps/plugin-cli";
import { onMount } from "solid-js";
import * as v from "valibot";
import Layout from "~/components/layout";
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

  onMount(async () => {
    const [_error, matches] = await tryCatch(getMatches());

    if (matches?.args.songpath && Array.isArray(matches.args.songpath.value)) {
      await songsStore.updateLocalSongs(matches.args.songpath.value);
    } else {
      await songsStore.updateLocalSongs(songsStore.paths());
    }

    navigate({
      to: search().redirect,
    });
  });

  return (
    <Layout>
      <div class="flex flex-grow items-center justify-center">
        <IconLoaderCircle class="animate-spin text-6xl" />
      </div>
    </Layout>
  );
}
