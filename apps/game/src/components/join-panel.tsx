import { t } from "~/lib/i18n";

import QRCodeView from "./qr-code";

interface JoinPanelProps {
  code: string;
  /** QR code above the code (side columns) instead of next to it. */
  vertical?: boolean;
  class?: string;
}

/** How to join the lobby from a phone: the code, the URL and a QR code, on a quiet card. */
export default function JoinPanel(props: JoinPanelProps) {
  const appUrl = import.meta.env.VITE_APP_URL as string;

  return (
    <div
      class={`flex rounded-[1.6cqw] bg-white/6 ring-1 ring-white/10 ring-inset ${props.class ?? ""}`}
      classList={{
        "h-full items-center gap-[1.6cqw] p-[1.2cqw] pl-[2cqw]": !props.vertical,
        "flex-col-reverse items-center gap-[1cqw] p-[1.6cqw]": props.vertical,
      }}
    >
      <div
        class="flex flex-col"
        classList={{ "items-end text-right": !props.vertical, "items-center text-center": props.vertical }}
      >
        <span class="text-[0.9cqw] font-bold tracking-[0.2em] text-white/60 uppercase">{t("home.joinLobby")}</span>
        <span class="mt-[0.4cqw] text-[3.6cqw] leading-none font-black tracking-[0.1em]">{props.code}</span>
        <span class="mt-[0.6cqw] text-[0.9cqw] text-white/60">{appUrl.replace(/^https?:\/\//, "")}/join</span>
      </div>
      <QRCodeView value={`${appUrl}/join/${props.code}`} class={props.vertical ? "aspect-square w-full" : "h-full"} />
    </div>
  );
}
