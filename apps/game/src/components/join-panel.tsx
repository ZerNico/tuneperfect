import { t } from "~/lib/i18n";

import QRCodeView from "./qr-code";

interface JoinPanelProps {
  code: string;
  /** QR code above the code (side columns) instead of next to it. */
  vertical?: boolean;
  class?: string;
}

/** How to join the lobby from a phone: the code, the URL and a QR code. */
export default function JoinPanel(props: JoinPanelProps) {
  const appUrl = import.meta.env.VITE_APP_URL as string;

  return (
    <div
      class={`flex gap-6 ${props.class ?? ""}`}
      classList={{ "h-full items-center": !props.vertical, "flex-col-reverse items-center": props.vertical }}
    >
      <div
        class="flex flex-col"
        classList={{ "items-end text-right": !props.vertical, "items-center text-center": props.vertical }}
      >
        <span class="text-sm font-black tracking-widest text-white/70 uppercase italic">{t("home.joinLobby")}</span>
        <span class="text-7xl leading-none text-display">{props.code}</span>
        <span class="mt-2 text-sm text-white/60">{appUrl.replace(/^https?:\/\//, "")}/join</span>
      </div>
      <QRCodeView value={`${appUrl}/join/${props.code}`} class={props.vertical ? "aspect-square w-full" : "h-full"} />
    </div>
  );
}
