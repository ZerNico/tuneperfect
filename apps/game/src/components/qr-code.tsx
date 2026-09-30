import QRCode from "qrcode";
import { createMemo, For } from "solid-js";

const FINDER_SIZE = 7;

interface QRCodeProps {
  value: string;
  class?: string;
}

/** A scannable QR code drawn as rounded dots with rounded finder "eyes". */
export default function QRCodeView(props: QRCodeProps) {
  const matrix = createMemo(() => {
    const { modules } = QRCode.create(props.value, { errorCorrectionLevel: "M" });
    const size = modules.size;

    const isFinder = (row: number, col: number) =>
      (row < FINDER_SIZE && col < FINDER_SIZE) ||
      (row < FINDER_SIZE && col >= size - FINDER_SIZE) ||
      (row >= size - FINDER_SIZE && col < FINDER_SIZE);

    const dots: { row: number; col: number }[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (modules.get(row, col) && !isFinder(row, col)) {
          dots.push({ row, col });
        }
      }
    }

    return {
      size,
      dots,
      finders: [
        [0, 0],
        [0, size - FINDER_SIZE],
        [size - FINDER_SIZE, 0],
      ] as const,
    };
  });

  return (
    <div class={`aspect-square rounded-[1cqw] bg-white p-[4.5%] ${props.class ?? ""}`}>
      <svg viewBox={`0 0 ${matrix().size} ${matrix().size}`} class="block h-full w-full" aria-hidden="true">
        <g fill="black">
          <For each={matrix().dots}>{(dot) => <circle cx={dot.col + 0.5} cy={dot.row + 0.5} r="0.45" />}</For>
          <For each={matrix().finders}>
            {([row, col]) => (
              <>
                <rect
                  x={col + 0.5}
                  y={row + 0.5}
                  width={FINDER_SIZE - 1}
                  height={FINDER_SIZE - 1}
                  rx="1.6"
                  fill="none"
                  stroke="black"
                  stroke-width="1"
                />
                <rect x={col + 2} y={row + 2} width="3" height="3" rx="0.8" />
              </>
            )}
          </For>
        </g>
      </svg>
    </div>
  );
}
