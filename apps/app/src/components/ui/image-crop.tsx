import { createEffect, createSignal, on } from "solid-js";
import { t } from "~/lib/i18n";
import IconMinus from "~icons/lucide/minus";
import IconPlus from "~icons/lucide/plus";
import Button from "./button";

interface ImageCropProps {
  imageUrl: string;
  resolution?: number;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  class?: string;
}

type GestureType = "none" | "drag" | "pinch";

interface CropState {
  scale: number;
  offsetX: number;
  offsetY: number;
  gesture: GestureType;
  lastPointer: { x: number; y: number } | null;
  lastPinch: { distance: number; center: { x: number; y: number } } | null;
}

export default function ImageCrop(props: ImageCropProps) {
  const canvasSize = () => props.resolution ?? 1024;
  let canvasRef: HTMLCanvasElement | undefined;
  let imageRef: HTMLImageElement | undefined;

  const [cropState, setCropState] = createSignal<CropState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    gesture: "none",
    lastPointer: null,
    lastPinch: null,
  });

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
    drawImage();
  };

  const applyDrag = (deltaX: number, deltaY: number) => {
    setCropState((prev) => {
      const ratio = getDisplayRatio();
      const newOffsetX = prev.offsetX + deltaX * ratio;
      const newOffsetY = prev.offsetY + deltaY * ratio;
      const constrained = constrainMovement(newOffsetX, newOffsetY, prev.scale);
      return { ...prev, ...constrained };
    });
    drawImage();
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
    setCropState((prev) => ({
      ...prev,
      gesture: "drag",
      lastPointer: getPointerPos(event),
      lastPinch: null,
    }));
  };

  const handlePointerMove = (event: PointerEvent) => {
    const state = cropState();
    if (state.gesture !== "drag" || !state.lastPointer) return;

    event.preventDefault();
    const pointer = getPointerPos(event);
    applyDrag(pointer.x - state.lastPointer.x, pointer.y - state.lastPointer.y);
    setCropState((prev) => ({ ...prev, lastPointer: pointer }));
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (!canvasRef) return;

    canvasRef.releasePointerCapture(event.pointerId);
    setCropState((prev) => ({
      ...prev,
      gesture: "none",
      lastPointer: null,
      lastPinch: null,
    }));
  };

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const pinchInfo = getPinchInfo(event.touches[0], event.touches[1]);
      setCropState((prev) => ({
        ...prev,
        gesture: "pinch",
        lastPointer: null,
        lastPinch: pinchInfo,
      }));
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    const state = cropState();
    if (state.gesture !== "pinch" || !state.lastPinch || event.touches.length !== 2) return;

    event.preventDefault();
    const pinchInfo = getPinchInfo(event.touches[0], event.touches[1]);
    const scaleChange = pinchInfo.distance / state.lastPinch.distance;
    applyZoom(state.scale * scaleChange, pinchInfo.center.x, pinchInfo.center.y);
    setCropState((prev) => ({ ...prev, lastPinch: pinchInfo }));
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) {
      setCropState((prev) => ({
        ...prev,
        gesture: "none",
        lastPointer: null,
        lastPinch: null,
      }));
    }
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

  const drawImage = () => {
    if (!canvasRef || !imageRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const state = cropState();
    const size = canvasSize();
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(imageRef, state.offsetX, state.offsetY, imageRef.naturalWidth * state.scale, imageRef.naturalHeight * state.scale);
  };

  const loadImage = () => {
    if (!imageRef) return;
    imageRef.onload = () => {
      if (!imageRef) return;
      const imageAspect = imageRef.naturalWidth / imageRef.naturalHeight;
      const initialScale = Math.max(
        imageAspect > 1 ? canvasSize() / imageRef.naturalHeight : canvasSize() / imageRef.naturalWidth,
        getMinimumScale()
      );

      setCropState({
        scale: initialScale,
        offsetX: (canvasSize() - imageRef.naturalWidth * initialScale) / 2,
        offsetY: (canvasSize() - imageRef.naturalHeight * initialScale) / 2,
        gesture: "none",
        lastPointer: null,
        lastPinch: null,
      });
      drawImage();
    };
    imageRef.src = props.imageUrl;
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

    cropCanvas.toBlob((blob) => blob && props.onCrop(blob), "image/webp", 1.0);
  };

  createEffect(() => {
    if (props.imageUrl) {
      imageRef = new Image();
      loadImage();
    }
  });

  createEffect(
    on(cropState, () => {
      if (imageRef?.complete) drawImage();
    })
  );

  const currentScale = cropState().scale;
  const minScale = getMinimumScale();

  return (
    <div class={`flex flex-col gap-4 ${props.class || ""}`}>
      <div class="flex flex-col items-center gap-4">
        <div class="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize()}
            height={canvasSize()}
            class="aspect-square w-full cursor-move select-none rounded-lg border-2 border-slate-200 shadow-md"
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
            class="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
            style={{ background: "radial-gradient(circle at center, transparent 70%, rgba(0, 0, 0, 0.6) 70%)" }}
          />

          <div class="pointer-events-none absolute inset-0 h-full w-full rounded-full border-3 border-white shadow-lg" />

          <div class="-translate-y-1/2 absolute top-1/2 right-3 flex flex-col gap-2">
            <button
              type="button"
              class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 shadow-lg backdrop-blur-sm transition-transform hover:bg-black/70 active:scale-95"
              onClick={() => handleZoomButtonClick("in")}
              disabled={currentScale >= 5}
            >
              <IconPlus class="h-5 w-5 text-white" />
            </button>
            <button
              type="button"
              class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 shadow-lg backdrop-blur-sm transition-transform hover:bg-black/70 active:scale-95"
              onClick={() => handleZoomButtonClick("out")}
              disabled={currentScale <= minScale}
            >
              <IconMinus class="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button onClick={props.onCancel}>{t("common.cancel")}</Button>
        <Button intent="gradient" onClick={exportCroppedImage}>
          {t("imageCrop.confirm")}
        </Button>
      </div>
    </div>
  );
}
