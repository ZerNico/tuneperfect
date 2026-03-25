import type { ErrorComponentProps } from "@tanstack/solid-router";
import { useNavigate } from "@tanstack/solid-router";
import { createMemo } from "solid-js";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function buildFullDetails(error: unknown, message: string, componentStack?: string): string {
  const parts: string[] = [message];
  if (error instanceof Error && error.stack) {
    parts.push("", error.stack);
  }
  if (componentStack) {
    parts.push("", "--- component ---", componentStack);
  }
  return parts.join("\n");
}

/** Root route error UI — replaces TanStack Router default `ErrorComponent`. */
export function RouteError(props: ErrorComponentProps) {
  const navigate = useNavigate();

  const message = createMemo(() => formatErrorMessage(props.error));
  const fullDetails = createMemo(() => buildFullDetails(props.error, message(), props.info?.componentStack));

  const goHome = () => {
    void navigate({ to: "/home" });
  };

  const tryAgain = () => {
    props.reset();
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(fullDetails());
      notify({ message: t("common.routeError.copied"), intent: "success" });
    } catch {
      notify({ message: t("common.routeError.copyFailed"), intent: "error" });
    }
  };

  const menuItems = createMemo((): MenuItem[] => [
    {
      type: "custom",
      interactive: false,
      render: () => (
        <div class="flex max-w-full flex-col gap-3 pb-2">
          <p class="font-primary text-lg leading-snug text-white/95">{message()}</p>
          <div class="flex flex-col gap-1">
            <span class="font-primary text-xs font-semibold tracking-wide text-white/50 uppercase">
              {t("common.routeError.detailsHeading")}
            </span>
            <textarea
              readOnly
              spellcheck={false}
              class="styled-scrollbars min-h-[12rem] w-full min-w-0 resize-y rounded-lg border border-white/15 bg-black/35 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              style={{ color: "rgb(244 244 245)" }}
              value={fullDetails()}
            />
          </div>
        </div>
      ),
    },
    {
      type: "button",
      label: t("common.routeError.copyDetails"),
      action: () => {
        void copyDetails();
      },
    },
    {
      type: "button",
      label: t("common.routeError.tryAgain"),
      action: tryAgain,
    },
    {
      type: "button",
      label: t("common.routeError.goHome"),
      action: goHome,
    },
  ]);

  return (
    <div class="min-h-screen font-primary text-base text-white">
      <Layout
        intent="secondary"
        header={<TitleBar title={t("common.routeError.title")} onBack={goHome} />}
        footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
      >
        <Menu items={menuItems()} onBack={goHome} gradient="gradient-settings" />
      </Layout>
    </div>
  );
}
