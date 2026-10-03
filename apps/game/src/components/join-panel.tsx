import { t } from "~/lib/i18n";

import QRCodeView from "./qr-code";

interface JoinPanelProps {
  code: string;
  /** QR code above the code (side columns) instead of next to it. */
  vertical?: boolean;
  class?: string;
}

/** How to join the lobby from a phone: the code in a white tag, the URL and a QR code, straight on the background. */
export default function JoinPanel(props: JoinPanelProps) {
  const appUrl = import.meta.env.VITE_APP_URL as string;

  return (
    <div
      class={`flex ${props.class ?? ""}`}
      classList={{
        "h-full items-center gap-[1.6cqw] py-[1.2cqw]": !props.vertical,
        "flex-col-reverse items-center gap-[1.2cqw]": props.vertical,
      }}
    >
      <div
        class="flex flex-col"
        classList={{ "items-end text-right": !props.vertical, "items-center text-center": props.vertical }}
      >
        <span class="text-[0.9cqw] font-bold tracking-[0.2em] text-white/60 uppercase">{t("home.joinLobby")}</span>
        {/* White tag like the title chips; `text-box` centres the letters, and the right padding is
            0.1em smaller to make up for the tracking after the last letter. */}
        <span class="mt-[0.6cqw] rounded-[0.6cqw] bg-white py-[0.8cqw] pr-[0.7cqw] pl-[1cqw] text-[3.1cqw] font-black tracking-[0.1em] text-slate-900 [text-box:trim-both_cap_alphabetic]">
          {props.code}
        </span>
        <span class="mt-[0.7cqw] text-[0.9cqw] text-white/60">{appUrl.replace(/^https?:\/\//, "")}/join</span>
      </div>
      <QRCodeView value={`${appUrl}/join/${props.code}`} class={props.vertical ? "aspect-square w-full" : "h-full"} />
    </div>
  );
}
