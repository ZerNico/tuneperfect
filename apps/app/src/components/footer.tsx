import { useQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { sessionQueryOptions } from "~/lib/auth";
import NavItems from "./nav-items";

export default function Footer() {
  const sessionQuery = useQuery(() => sessionQueryOptions());

  return (
    <Show when={sessionQuery.data}>
      <footer
        class="fixed right-0 bottom-0 left-0 z-2 flex justify-center border-white/10 border-t bg-[#203141]/60 px-4 py-2 backdrop-blur-lg md:hidden"
        style={{ "margin-right": "var(--scrollbar-width, 0px)" }}
      >
        <NavItems class="w-max" />
      </footer>
    </Show>
  );
}
