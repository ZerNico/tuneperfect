import type { QueryClient } from "@tanstack/solid-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/solid-router";
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
      <div class="gradient-bg-secondary flex min-h-[100dvh] flex-col pb-16 font-primary text-white md:pb-0">
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
