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
  const code = `([A-Z0-9]{${LOBBY_CODE_LENGTH}})`;
  // The link must match on /join/, otherwise the domain ("tuneperfect") reads as a code.
  const match =
    value.match(new RegExp(`/join/${code}(?![A-Z0-9])`, "i")) ?? value.trim().match(new RegExp(`^${code}$`, "i"));
  return match?.[1]?.toUpperCase() ?? null;
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

  onMount(() => {
    if (!canScan || !video || !BarcodeDetector) return;

    // Cleanups must be registered now: after an await, Solid no longer knows whose they are
    let closed = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    onCleanup(() => {
      closed = true;
      clearInterval(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    });

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setCameraFailed(true);
        return;
      }
      // Closed while the camera prompt was open
      if (closed) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => {});
      if (closed) return;

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      timer = setInterval(async () => {
        if (!video || video.readyState < 2) return;
        const codes = await detector.detect(video).catch(() => []);
        for (const { rawValue } of codes) {
          const code = codeFromScan(rawValue);
          if (code && !closed) {
            clearInterval(timer);
            props.onCode(code);
            return;
          }
        }
      }, SCAN_INTERVAL_MS);
    })();
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
