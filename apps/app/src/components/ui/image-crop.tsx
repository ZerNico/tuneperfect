import { createEffect, createMemo, createSignal } from "solid-js";
import IconMinus from "~icons/ph/minus-bold";
import IconPlus from "~icons/ph/plus-bold";

import { t } from "~/lib/i18n";

import Button from "./button";

interface ImageCropProps {
  imageUrl: string;
  resolution?: number;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  class?: string;
}

interface CropState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** The gesture in progress. Not reactive: only the crop it produces is drawn. */
type Gesture =
  | { type: "none" }
  | { type: "drag"; lastPointer: { x: number; y: number } }
  | { type: "pinch"; lastPinch: { distance: number; center: { x: number; y: number } } };

export default function ImageCrop(props: ImageCropProps) {
  const canvasSize = () => props.resolution ?? 1024;
  let canvasRef: HTMLCanvasElement | undefined;
  let imageRef: HTMLImageElement | undefined;

  const [cropState, setCropState] = createSignal<CropState>({ scale: 1, offsetX: 0, offsetY: 0 });
  let gesture: Gesture = { type: "none" };

  const getDisplayRatio = () => {
    if (!canvasRef) return 2;
    return canvasSize() / canvasRef.getBoundingClientRect().width;
  };

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

  const applyZoom = (newScale: number, centerX?: number, centerY?: number) => {
    setCropState((prev) => {
      const constrainedScale = Math.max(getMinimumScale(), Math.min(5, newScale));
      if (!imageRef) return { ...prev, scale: constrainedScale };

      let newOffsetX = prev.offsetX;
      let newOffsetY = prev.offsetY;

      if (centerX !== undefined && centerY !== undefined) {
        const ratio = getDisplayRatio();
        const canvasCenterX = centerX * ratio;
        const canvasCenterY = centerY * ratio;

        const imagePointX = (canvasCenterX - prev.offsetX) / prev.scale;
        const imagePointY = (canvasCenterY - prev.offsetY) / prev.scale;

        newOffsetX = canvasCenterX - imagePointX * constrainedScale;
        newOffsetY = canvasCenterY - imagePointY * constrainedScale;
      }

      const constrained = constrainMovement(newOffsetX, newOffsetY, constrainedScale);
      return { ...prev, scale: constrainedScale, ...constrained };
    });
  };

  const applyDrag = (deltaX: number, deltaY: number) => {
    setCropState((prev) => {
      const ratio = getDisplayRatio();
      const newOffsetX = prev.offsetX + deltaX * ratio;
      const newOffsetY = prev.offsetY + deltaY * ratio;
      const constrained = constrainMovement(newOffsetX, newOffsetY, prev.scale);
      return { ...prev, ...constrained };
    });
  };

  const getPointerPos = (event: PointerEvent | MouseEvent) => {
    if (!canvasRef) return { x: 0, y: 0 };
    const rect = canvasRef.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const getPinchInfo = (touch1: Touch, touch2: Touch) => {
    if (!canvasRef) return { distance: 0, center: { x: 0, y: 0 } };
    const rect = canvasRef.getBoundingClientRect();
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return {
      distance: Math.sqrt(dx * dx + dy * dy),
      center: {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      },
    };
  };

  // Pointer event handlers for drag operations
  const handlePointerStart = (event: PointerEvent) => {
    event.preventDefault();
    if (!canvasRef) return;

    canvasRef.setPointerCapture(event.pointerId);
    gesture = { type: "drag", lastPointer: getPointerPos(event) };
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (gesture.type !== "drag") return;

    event.preventDefault();
    const pointer = getPointerPos(event);
    applyDrag(pointer.x - gesture.lastPointer.x, pointer.y - gesture.lastPointer.y);
    gesture.lastPointer = pointer;
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (!canvasRef) return;

    canvasRef.releasePointerCapture(event.pointerId);
    gesture = { type: "none" };
  };

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      gesture = { type: "pinch", lastPinch: getPinchInfo(event.touches[0], event.touches[1]) };
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (gesture.type !== "pinch" || event.touches.length !== 2) return;

    event.preventDefault();
    const pinchInfo = getPinchInfo(event.touches[0], event.touches[1]);
    const scaleChange = pinchInfo.distance / gesture.lastPinch.distance;
    applyZoom(cropState().scale * scaleChange, pinchInfo.center.x, pinchInfo.center.y);
    gesture.lastPinch = pinchInfo;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) gesture = { type: "none" };
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!canvasRef) return;

    const rect = canvasRef.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    handleZoom(event.deltaY < 0 ? 1 : -1, mouseX, mouseY);
  };

  const handleZoomButtonClick = (direction: "in" | "out") => {
    if (!canvasRef) return;
    const currentScale = cropState().scale;
    const newScale = direction === "in" ? currentScale * 1.25 : currentScale * 0.8;
    const rect = canvasRef.getBoundingClientRect();
    applyZoom(newScale, rect.width / 2, rect.height / 2);
  };

  const drawImage = (state: CropState) => {
    if (!canvasRef || !imageRef?.complete) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

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

  const loadImage = (url: string) => {
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
    };
    imageRef.src = url;
  };

  const handleZoom = (direction: "in" | "out" | number, centerX?: number, centerY?: number) => {
    const currentScale = cropState().scale;
    let newScale: number;

    if (typeof direction === "number") {
      const zoom = Math.exp(direction * 0.1);
      newScale = currentScale * zoom;
    } else {
      newScale = direction === "in" ? currentScale * 1.25 : currentScale * 0.8;
    }

    applyZoom(newScale, centerX, centerY);
  };

  const exportCroppedImage = async () => {
    if (!canvasRef || !imageRef) return;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropCanvas.height = 512;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    const state = cropState();
    const scaleRatio = 1 / state.scale;
    const sourceX = -state.offsetX * scaleRatio;
    const sourceY = -state.offsetY * scaleRatio;
    const sourceSize = canvasSize() * scaleRatio;

    cropCtx.drawImage(imageRef, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);

    const onCrop = props.onCrop;
    cropCanvas.toBlob((blob) => blob && onCrop(blob), "image/webp", 1.0);
  };

  createEffect(
    () => props.imageUrl,
    (url) => {
      if (!url) return;
      imageRef = new Image();
      loadImage(url);
    },
  );

  // Every change to the crop shows right away: zoom, drag and the initial fit once the image loaded.
  createEffect(cropState, drawImage);

  const currentScale = createMemo(() => cropState().scale);
  const minScale = createMemo(() => getMinimumScale());

  return (
    <div class={`flex flex-col gap-4 ${props.class || ""}`}>
      <div class="flex flex-col items-center gap-4">
        <div class="relative">
          <canvas
            ref={canvasRef}
            aria-label={t("editProfile.cropImage")}
            width={canvasSize()}
            height={canvasSize()}
            class="aspect-square w-full cursor-move rounded-[16px] ring-1 ring-white/10 select-none"
            style={{ "touch-action": "none" }}
            onPointerDown={handlePointerStart}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          <div
            class="pointer-events-none absolute inset-0 h-full w-full rounded-[16px]"
            style={{ background: "radial-gradient(circle at center, transparent 70%, rgba(0, 0, 0, 0.6) 70%)" }}
          />

          <div class="pointer-events-none absolute inset-0 h-full w-full rounded-full border-3 border-white" />

          <div class="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-2">
            <button
              type="button"
              aria-label={t("imageCrop.zoomIn")}
              class="flex size-10 cursor-pointer items-center justify-center rounded-[10px] bg-black/60 text-lg backdrop-blur-sm transition-[scale,background-color,opacity] hover:bg-black/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => handleZoomButtonClick("in")}
              disabled={currentScale() >= 5}
            >
              <IconPlus />
            </button>
            <button
              type="button"
              aria-label={t("imageCrop.zoomOut")}
              class="flex size-10 cursor-pointer items-center justify-center rounded-[10px] bg-black/60 text-lg backdrop-blur-sm transition-[scale,background-color,opacity] hover:bg-black/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => handleZoomButtonClick("out")}
              disabled={currentScale() <= minScale()}
            >
              <IconMinus />
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Button onClick={props.onCancel}>{t("common.cancel")}</Button>
        <Button intent="gradient" onClick={exportCroppedImage}>
          {t("imageCrop.confirm")}
        </Button>
      </div>
    </div>
  );
}
