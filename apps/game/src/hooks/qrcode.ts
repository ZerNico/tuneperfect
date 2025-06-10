import { access, type MaybeAccessor } from "@solid-primitives/utils";
import QRCode, { type QRCodeToDataURLOptions } from "qrcode";
import { createEffect, createSignal } from "solid-js";

export function createQRCode(text: MaybeAccessor<string>, options?: MaybeAccessor<QRCodeToDataURLOptions>) {
  const [url, setUrl] = createSignal<string | null>(null);

  createEffect(() => {
    QRCode.toDataURL(access(text), access(options)).then(setUrl);
  });

  return url;
}
