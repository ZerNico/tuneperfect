import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { Suspense } from "solid-js";

import Footer from "~/components/footer";
import Header from "~/components/header";
import { ToastRegion } from "~/components/ui/toast";
import { DialogProvider } from "~/lib/dialog.tsx";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <DialogProvider>
      <div class="gradient-bg-primary relative isolate flex min-h-[100dvh] flex-col pb-24 text-white md:pb-0">
        <Aurora />
        <Header />
        <Suspense>
          <Outlet />
        </Suspense>
        <Footer />
        <TanStackRouterDevtools />
        <ToastRegion />
      </div>
    </DialogProvider>
  );
}

/** Two soft glows in the section's colours, drifting slowly; kept faint so content stays the focus. */
function Aurora() {
  return (
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        class="absolute -top-[15%] -left-[30%] h-[50%] w-[90%] animate-aurora rounded-full opacity-25 blur-[70px] transition-colors duration-700 motion-reduce:animate-none"
        style={{ background: "var(--accent-from)" }}
      />
      <div
        class="absolute -top-[5%] -right-[35%] h-[45%] w-[80%] animate-aurora rounded-full opacity-15 blur-[70px] transition-colors duration-700 [animation-delay:-7s] [animation-direction:reverse] motion-reduce:animate-none"
        style={{ background: "var(--accent-to)" }}
      />
    </div>
  );
}
