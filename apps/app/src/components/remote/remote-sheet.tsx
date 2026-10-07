import { Link, useLocation } from "@tanstack/solid-router";
import { createEffect, createSignal, on, Show } from "solid-js";

import Sheet from "~/components/ui/sheet";
import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

import RemotePanel, { panelTitle } from "./remote-panel";

/**
 * Brings up your controls from anywhere in the lobby when it becomes your move in the game (e.g.
 * your duel in versus), and vibrates. On the controller itself there's no need.
 */
export default function RemoteSheet() {
  const remote = useRemote();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);

  const panel = () => remote.state()?.panel ?? null;
  /** This move was announced already (or seen on the controller): don't pop up or vibrate for it again. */
  let announced = false;

  createEffect(
    on(
      () => remote.state()?.attention,
      (attention) => {
        // Not connected right now: a reconnect brings back the same move, which was announced already
        if (attention === undefined) return;
        if (!attention) {
          announced = false;
          setOpen(false);
          return;
        }
        if (announced) return;
        announced = true;
        if (location().pathname === "/controller") return;
        setOpen(true);
        navigator.vibrate?.([40, 60, 40]);
      },
    ),
  );
  // Went to the controller: the same controls are right there.
  createEffect(() => {
    if (location().pathname === "/controller") setOpen(false);
  });

  return (
    <Sheet
      open={open() && !!panel()}
      onOpenChange={setOpen}
      title={(panel() && panelTitle(panel()!)) ?? t("remote.yourMove")}
    >
      <Show when={panel()}>{(panel) => <RemotePanel panel={panel()} titled={false} />}</Show>
      <Link
        to="/controller"
        class="mt-3 flex h-12 items-center justify-center rounded-[12px] font-bold text-white/70 transition-colors hover:bg-white/8 hover:text-white"
      >
        {t("remote.open")}
      </Link>
    </Sheet>
  );
}
