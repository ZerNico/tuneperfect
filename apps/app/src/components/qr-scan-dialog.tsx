import { createSignal, onCleanup, onMount, Show } from "solid-js";
import IconCamera from "~icons/ph/camera-bold";

import Dialog from "~/components/ui/dialog";
import { t } from "~/lib/i18n";

import { LOBBY_CODE_LENGTH } from "./code-input";

// Not in TypeScript's DOM types yet.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (options: { formats: string[] }): BarcodeDetectorLike } | undefined;

const SCAN_INTERVAL_MS = 250;

/** The lobby code from a scanned value: the game's join link (…/join/CODE) or a bare code. */
function codeFromScan(value: string): string | null {
  const pattern = new RegExp(`(?:/join/)?([A-Z0-9]{${LOBBY_CODE_LENGTH}})\\b`, "i");
  return value.match(pattern)?.[1]?.toUpperCase() ?? null;
}

interface QrScanDialogProps {
  onClose: () => void;
  onCode: (code: string) => void;
}

/**
 * Scans the QR code the game shows. Uses the camera where the browser can read QR codes (Chrome on
 * Android); elsewhere (Safari) it explains the camera app, since the QR code is a join link anyway.
 */
export default function QrScanDialog(props: QrScanDialogProps) {
  const canScan = typeof BarcodeDetector !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [cameraFailed, setCameraFailed] = createSignal(false);
  let video: HTMLVideoElement | undefined;

  onMount(async () => {
    if (!canScan || !video || !BarcodeDetector) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      setCameraFailed(true);
      return;
    }
    onCleanup(() => {
      for (const track of stream.getTracks()) track.stop();
    });

    video.srcObject = stream;
    await video.play().catch(() => {});

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const timer = setInterval(async () => {
      if (!video || video.readyState < 2) return;
      const codes = await detector.detect(video).catch(() => []);
      for (const { rawValue } of codes) {
        const code = codeFromScan(rawValue);
        if (code) {
          clearInterval(timer);
          props.onCode(code);
          return;
        }
      }
    }, SCAN_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <Dialog title={t("join.scanTitle")} onClose={props.onClose}>
      <Show
        when={canScan && !cameraFailed()}
        fallback={
          <div class="flex flex-col items-center gap-4 py-2 text-center">
            <span class="gradient-accent flex size-16 items-center justify-center rounded-full text-3xl">
              <IconCamera />
            </span>
            <p class="text-white/75">{t("join.scanWithCamera")}</p>
          </div>
        }
      >
        <div class="flex flex-col gap-3">
          <div class="relative aspect-square overflow-hidden rounded-[16px] bg-black">
            <video ref={video} class="size-full object-cover" muted playsinline />
            {/* Frame to aim with */}
            <div class="absolute inset-[18%] rounded-[16px] ring-4 ring-white/80" />
          </div>
          <p class="text-center text-sm text-white/60">{t("join.scanHint")}</p>
        </div>
      </Show>
    </Dialog>
  );
}
