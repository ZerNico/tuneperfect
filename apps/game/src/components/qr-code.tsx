import QRCode from "qrcode";
import { createMemo, For } from "solid-js";

const FINDER_SIZE = 7;
/** White margin around the code, as a share of its width in modules (about 9% of the card per side). */
const MARGIN = 0.11;
/** Corner radius as a share of the whole card. */
const RADIUS = 0.07;

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

  // The white card is drawn in the SVG, so its margin and corners scale with the code itself. CSS
  // padding in % would follow the parent's width and differ between the home screen and the lobby.
  const margin = () => matrix().size * MARGIN;
  const total = () => matrix().size + 2 * margin();

  return (
    <div class={`aspect-square ${props.class ?? ""}`}>
      <svg viewBox={`${-margin()} ${-margin()} ${total()} ${total()}`} class="block h-full w-full" aria-hidden="true">
        <rect x={-margin()} y={-margin()} width={total()} height={total()} rx={total() * RADIUS} fill="white" />
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
