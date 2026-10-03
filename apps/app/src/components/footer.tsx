import { useQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";

import { sessionQueryOptions } from "~/lib/auth";

import NavItems from "./nav-items";

export default function Footer() {
  const sessionQuery = useQuery(() => sessionQueryOptions());

  return (
    <Show when={sessionQuery.data}>
      <footer
        class="fixed right-0 bottom-0 left-0 z-2 flex justify-center bg-black/40 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
        style={{ "margin-right": "var(--scrollbar-width, 0px)" }}
      >
        <NavItems class="w-full max-w-md" />
      </footer>
    </Show>
  );
}
