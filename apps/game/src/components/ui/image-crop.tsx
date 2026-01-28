import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import IconMinus from "~icons/lucide/minus";
import IconPlus from "~icons/lucide/plus";
import IconF5Key from "~icons/sing/f5-key";
import IconF6Key from "~icons/sing/f6-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";
import Button from "./button";

interface ImageCropProps {
  imageUrl: string;
  resolution?: number;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
  layer?: number;
}

interface CropState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export default function ImageCrop(props: ImageCropProps) {
  const canvasSize = () => props.resolution ?? 512;
  let canvasRef: HTMLCanvasElement | undefined;
  let imageRef: HTMLImageElement | undefined;

  const [selected, setSelected] = createSignal(true);
  const [cropState, setCropState] = createSignal<CropState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const PAN_SPEED = 20;
  const ZOOM_SPEED = 0.1;

  const getMinimumScale = () => {
    if (!imageRef) return 0.1;
    const minScaleX = canvasSize() / imageRef.naturalWidth;
    const minScaleY = canvasSize() / imageRef.naturalHeight;
    return Math.max(minScaleX, minScaleY);
  };

  const constrainMovement = (offsetX: number, offsetY: number, scale: number) => {
    if (!imageRef) return { offsetX, offsetY };

    const imageWidth = imageRef.naturalWidth * scale;
    const imageHeight = imageRef.naturalHeight * scale;
    const minX = canvasSize() - imageWidth;
    const maxX = 0;
    const minY = canvasSize() - imageHeight;
    const maxY = 0;

    return {
      offsetX: Math.max(minX, Math.min(maxX, offsetX)),
      offsetY: Math.max(minY, Math.min(maxY, offsetY)),
    };
  };

  const applyZoom = (direction: "in" | "out") => {
    setCropState((prev) => {
      const zoomFactor = direction === "in" ? 1 + ZOOM_SPEED : 1 - ZOOM_SPEED;
      const newScale = Math.max(getMinimumScale(), Math.min(5, prev.scale * zoomFactor));

      if (!imageRef) return { ...prev, scale: newScale };

      const centerX = canvasSize() / 2;
      const centerY = canvasSize() / 2;

      const imagePointX = (centerX - prev.offsetX) / prev.scale;
      const imagePointY = (centerY - prev.offsetY) / prev.scale;

      const newOffsetX = centerX - imagePointX * newScale;
      const newOffsetY = centerY - imagePointY * newScale;

      const constrained = constrainMovement(newOffsetX, newOffsetY, newScale);
      return { scale: newScale, ...constrained };
    });
    drawImage();
  };

  const applyPan = (deltaX: number, deltaY: number) => {
    setCropState((prev) => {
      const newOffsetX = prev.offsetX + deltaX;
      const newOffsetY = prev.offsetY + deltaY;
      const constrained = constrainMovement(newOffsetX, newOffsetY, prev.scale);
      return { ...prev, ...constrained };
    });
    drawImage();
  };

  const drawImage = () => {
    if (!canvasRef || !imageRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const state = cropState();
    const size = canvasSize();
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      imageRef,
      state.offsetX,
      state.offsetY,
      imageRef.naturalWidth * state.scale,
      imageRef.naturalHeight * state.scale,
    );
  };

  const loadImage = () => {
    if (!imageRef) return;
    imageRef.onload = () => {
      if (!imageRef) return;
      const imageAspect = imageRef.naturalWidth / imageRef.naturalHeight;
      const initialScale = Math.max(
        imageAspect > 1 ? canvasSize() / imageRef.naturalHeight : canvasSize() / imageRef.naturalWidth,
        getMinimumScale(),
      );

      setCropState({
        scale: initialScale,
        offsetX: (canvasSize() - imageRef.naturalWidth * initialScale) / 2,
        offsetY: (canvasSize() - imageRef.naturalHeight * initialScale) / 2,
      });
      drawImage();
    };
    imageRef.src = props.imageUrl;
  };

  const exportCroppedImage = () => {
    if (!canvasRef || !imageRef) return;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropCanvas.height = 256;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    const state = cropState();
    const scaleRatio = 1 / state.scale;
    const sourceX = -state.offsetX * scaleRatio;
    const sourceY = -state.offsetY * scaleRatio;
    const sourceSize = canvasSize() * scaleRatio;

    cropCtx.drawImage(imageRef, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 256, 256);

    const dataUrl = cropCanvas.toDataURL("image/webp", 0.9);
    props.onCrop(dataUrl);
  };

  useNavigation(() => ({
    layer: props.layer ?? 1,
    onKeydown(event) {
      switch (event.action) {
        case "left":
          applyPan(PAN_SPEED, 0);
          break;
        case "right":
          applyPan(-PAN_SPEED, 0);
          break;
        case "up":
          applyPan(0, PAN_SPEED);
          break;
        case "down":
          applyPan(0, -PAN_SPEED);
          break;
        case "zoom-out":
          applyZoom("out");
          playSound("select");
          break;
        case "zoom-in":
          applyZoom("in");
          playSound("select");
          break;
        case "back":
          props.onCancel();
          playSound("confirm");
          break;
        case "confirm":
          exportCroppedImage();
          playSound("confirm");
          break;
      }
    },
    onRepeat(event) {
      switch (event.action) {
        case "left":
          applyPan(PAN_SPEED, 0);
          break;
        case "right":
          applyPan(-PAN_SPEED, 0);
          break;
        case "up":
          applyPan(0, PAN_SPEED);
          break;
        case "down":
          applyPan(0, -PAN_SPEED);
          break;
        case "zoom-out":
          applyZoom("out");
          break;
        case "zoom-in":
          applyZoom("in");
          break;
      }
    },
  }));

  onMount(() => {
    imageRef = new Image();
    loadImage();
  });

  createEffect(
    on(cropState, () => {
      if (imageRef?.complete) drawImage();
    }),
  );

  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };

  const handlePointerDown = (e: PointerEvent) => {
    if (!canvasRef) return;
    isDragging = true;
    canvasRef.setPointerCapture(e.pointerId);
    lastPointer = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastPointer.x;
    const deltaY = e.clientY - lastPointer.y;
    applyPan(deltaX, deltaY);
    lastPointer = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!canvasRef) return;
    isDragging = false;
    canvasRef.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    applyZoom(e.deltaY < 0 ? "in" : "out");
  };

  const handleZoomClick = (direction: "in" | "out") => {
    applyZoom(direction);
    playSound("select");
  };

  return (
    <Layout
      intent="popup"
      header={<TitleBar title={t("settings.sections.localPlayers.cropAvatar")} onBack={props.onCancel} />}
      footer={<KeyHints hints={["navigate", "back", "confirm"]} />}
    >
      <div class="flex flex-grow flex-col items-center justify-center gap-6">
        <div class="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize()}
            height={canvasSize()}
            class="aspect-square w-64 cursor-move select-none rounded-full"
            style={{ "touch-action": "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          />

          <div class="pointer-events-none absolute inset-0 rounded-full border-3 border-white shadow-lg" />

          <div class="absolute top-1/2 -right-24 flex -translate-y-1/2 flex-col gap-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/20 shadow-lg backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
                onClick={() => handleZoomClick("in")}
              >
                <IconPlus class="h-5 w-5 text-white" />
              </button>
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRB class="text-sm text-white/70" />}>
                <IconF6Key class="text-sm text-white/70" />
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/20 shadow-lg backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
                onClick={() => handleZoomClick("out")}
              >
                <IconMinus class="h-5 w-5 text-white" />
              </button>
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm text-white/70" />}>
                <IconF5Key class="text-sm text-white/70" />
              </Show>
            </div>
          </div>
        </div>

        <Button
          class="w-full"
          gradient="gradient-settings"
          selected={selected()}
          onClick={() => {
            exportCroppedImage();
            playSound("confirm");
          }}
          onMouseEnter={() => setSelected(true)}
          layer={props.layer ?? 1}
        >
          {t("settings.save")}
        </Button>
      </div>
    </Layout>
  );
}
