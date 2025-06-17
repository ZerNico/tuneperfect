import { createMemo, createSignal, For, type JSX } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import { useTextInput } from "~/hooks/use-text-input";
import { t } from "~/lib/i18n";
import IconArrowBigDown from "~icons/lucide/arrow-big-down";
import IconArrowBigLeft from "~icons/lucide/arrow-big-left";
import IconArrowBigUp from "~icons/lucide/arrow-big-up";
import IconGamepadB from "~icons/sing/gamepad-b";
import IconGamepadX from "~icons/sing/gamepad-x";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";

interface VirtualKeyboardProps {
  inputRef: HTMLInputElement;
  layer?: number;
  onClose?: () => void;
}

interface Key {
  content: JSX.Element;
  colSpan?: number;
  highlight?: boolean;
  action?: () => void;
  hint?: JSX.Element;
}

export function VirtualKeyboard(props: VirtualKeyboardProps) {
  const [position, setPosition] = createSignal<{ row: number; col: number }>({ row: 0, col: 0 });
  const [shift, setShift] = createSignal(false);
  const [symbols, setSymbols] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);

  const { moveCursor, writeCharacter, deleteCharacter } = useTextInput(() => props.inputRef);

  const goLeft = () => {
    const keys = activeKeys();
    const currentRow = keys[position().row];

    if (!currentRow) return;

    let newCol = position().col - 1;

    if (newCol < 0) {
      newCol = currentRow.length - 1;
    }

    setPosition({ row: position().row, col: newCol });
  };

  const goRight = () => {
    const keys = activeKeys();
    const currentRow = keys[position().row];

    if (!currentRow) return;

    let newCol = position().col + 1;

    if (newCol >= currentRow.length) {
      newCol = 0;
    }

    setPosition({ row: position().row, col: newCol });
  };

  const goUp = () => {
    const keys = activeKeys();
    const currentRow = position().row;

    const newRow = currentRow === 0 ? keys.length - 1 : currentRow - 1;

    if (!keys[newRow] || !keys[currentRow]) return;

    const bestCol = findBestMatchingKey(keys[newRow], currentRow, position().col, keys);

    setPosition({ row: newRow, col: bestCol });
  };

  const goDown = () => {
    const keys = activeKeys();
    const currentRow = position().row;

    const newRow = currentRow === keys.length - 1 ? 0 : currentRow + 1;

    if (!keys[newRow] || !keys[currentRow]) return;

    const bestCol = findBestMatchingKey(keys[newRow], currentRow, position().col, keys);

    setPosition({ row: newRow, col: bestCol });
  };

  const getBaseLayer = () => {
    if (shift()) {
      return symbols() ? "symbols-uppercase" : "uppercase";
    }

    return symbols() ? "symbols-lowercase" : "lowercase";
  };

  useNavigation(() => ({
    layer: props.layer || 0,
    onKeydown(event) {
      if (event.action === "left") {
        goLeft();
      } else if (event.action === "right") {
        goRight();
      } else if (event.action === "up") {
        goUp();
      } else if (event.action === "down") {
        goDown();
      } else if (event.action === "confirm") {
        setPressed(true);
      } else if (event.action === "clear") {
        deleteCharacter();
      } else if (event.action === "back") {
        props.onClose?.();
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        const currentKey = activeKeys()[position().row]?.[position().col];
        if (currentKey?.action) {
          currentKey.action();
        } else if (typeof currentKey?.content === "string") {
          writeCharacter(currentKey.content);
        }
      }
    },
  }));

  const activeKeys = createMemo((): Key[][] => {
    const baseLayer = baseLayers[getBaseLayer()];

    const specialKeys = [
      [
        {
          content: shift() ? <IconArrowBigDown /> : <IconArrowBigUp />,
          colSpan: 2,
          highlight: true,
          action: () => setShift((prev) => !prev),
        },
        {
          content: symbols() ? "Aa" : "@#",
          colSpan: 2,
          highlight: true,
          action: () => setSymbols((prev) => !prev),
        },
        {
          content: t("virtualKeyboard.space"),
          colSpan: 4,
          highlight: true,
          action: () => writeCharacter(" "),
        },
        {
          content: <IconArrowBigLeft />,
          hint: <IconGamepadX />,
          colSpan: 2,
          highlight: true,
          action: () => deleteCharacter(),
        },
      ],
      [
        { content: <IconTriangleLeft class="text-sm" />, highlight: true, action: () => moveCursor("left") },
        { content: <IconTriangleRight class="text-sm" />, highlight: true, action: () => moveCursor("right") },
        { content: "", colSpan: 5, highlight: true, action: () => {} },
        {
          content: t("virtualKeyboard.done"),
          hint: <IconGamepadB />,
          colSpan: 3,
          highlight: true,
          action: () => props.onClose?.(),
        },
      ],
    ];

    return [...baseLayer, ...specialKeys];
  });

  return (
    <div class="grid grid-cols-[repeat(10,2cqw)] gap-1 rounded-lg bg-slate-900 p-2 text-white">
      <For each={activeKeys()}>
        {(row, rowIndex) => (
          <For each={row}>
            {(key, colIndex) => (
              <button
                type="button"
                class="relative flex h-8 cursor-pointer items-center justify-center rounded-md transition-transform ease-in-out active:scale-95"
                classList={{
                  "gradient-sing bg-gradient-to-r": rowIndex() === position().row && colIndex() === position().col,
                  "scale-95": rowIndex() === position().row && colIndex() === position().col && pressed(),
                  "bg-slate-800": key.highlight,
                }}
                style={{ "grid-column": `span ${key.colSpan || 1}` }}
                onMouseEnter={() => setPosition({ row: rowIndex(), col: colIndex() })}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (key.action) {
                    key.action();
                  } else if (typeof key.content === "string") {
                    writeCharacter(key.content);
                  }
                }}
              >
                {key.content}
                {key.hint && <div class="absolute top-1 left-1 text-xs">{key.hint}</div>}
              </button>
            )}
          </For>
        )}
      </For>
    </div>
  );
}

const findBestMatchingKey = (targetRow: Key[], currentRowIdx: number, currentColIdx: number, keys: Key[][]) => {
  const currentRow = keys[currentRowIdx];
  if (!currentRow) return 0;

  let currentKeyStartPosition = 0;
  for (let i = 0; i < currentColIdx; i++) {
    currentKeyStartPosition += currentRow[i]?.colSpan || 1;
  }

  const currentKeySpan = currentRow[currentColIdx]?.colSpan || 1;
  const currentKeyMidpoint = currentKeyStartPosition + currentKeySpan / 2;

  let bestCol = 0;
  let bestDistance = Number.MAX_VALUE;
  let positionSum = 0;

  for (let i = 0; i < targetRow.length; i++) {
    const keySpan = targetRow[i]?.colSpan || 1;
    const keyMidpoint = positionSum + keySpan / 2;
    const distance = Math.abs(keyMidpoint - currentKeyMidpoint);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCol = i;
    }

    positionSum += keySpan;
  }

  return bestCol;
};

const lowercase: Key[][] = [
  [
    { content: "1" },
    { content: "2" },
    { content: "3" },
    { content: "4" },
    { content: "5" },
    { content: "6" },
    { content: "7" },
    { content: "8" },
    { content: "9" },
    { content: "0" },
  ],
  [
    { content: "q" },
    { content: "w" },
    { content: "e" },
    { content: "r" },
    { content: "t" },
    { content: "y" },
    { content: "u" },
    { content: "i" },
    { content: "o" },
    { content: "p" },
  ],
  [
    { content: "a" },
    { content: "s" },
    { content: "d" },
    { content: "f" },
    { content: "g" },
    { content: "h" },
    { content: "j" },
    { content: "k" },
    { content: "l" },
    { content: '"' },
  ],
  [
    { content: "z" },
    { content: "x" },
    { content: "c" },
    { content: "v" },
    { content: "b" },
    { content: "n" },
    { content: "m" },
    { content: "-" },
    { content: "_" },
    { content: "/" },
  ],
];

const uppercase: Key[][] = [
  [
    { content: "1" },
    { content: "2" },
    { content: "3" },
    { content: "4" },
    { content: "5" },
    { content: "6" },
    { content: "7" },
    { content: "8" },
    { content: "9" },
    { content: "0" },
  ],
  [
    { content: "Q" },
    { content: "W" },
    { content: "E" },
    { content: "R" },
    { content: "T" },
    { content: "Y" },
    { content: "U" },
    { content: "I" },
    { content: "O" },
    { content: "P" },
  ],
  [
    { content: "A" },
    { content: "S" },
    { content: "D" },
    { content: "F" },
    { content: "G" },
    { content: "H" },
    { content: "J" },
    { content: "K" },
    { content: "L" },
    { content: '"' },
  ],
  [
    { content: "Z" },
    { content: "X" },
    { content: "C" },
    { content: "V" },
    { content: "B" },
    { content: "N" },
    { content: "M" },
    { content: "-" },
    { content: "_" },
    { content: "/" },
  ],
];

const symbolsLowercase: Key[][] = [
  [
    { content: "@" },
    { content: "#" },
    { content: "€" },
    { content: "_" },
    { content: "&" },
    { content: "-" },
    { content: "+" },
    { content: "(" },
    { content: ")" },
    { content: "/" },
  ],
  [
    { content: "*" },
    { content: ":" },
    { content: ";" },
    { content: "," },
    { content: "." },
    { content: "?" },
    { content: "!" },
    { content: "'" },
    { content: '"' },
    { content: "=" },
  ],
  [
    { content: "ä" },
    { content: "ö" },
    { content: "ü" },
    { content: "ß" },
    { content: "{" },
    { content: "}" },
    { content: "[" },
    { content: "]" },
    { content: "°" },
    { content: "´" },
  ],
  [
    { content: "~" },
    { content: "æ" },
    { content: "£" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
  ],
];

const symbolsUppercase: Key[][] = [
  [
    { content: "@" },
    { content: "#" },
    { content: "€" },
    { content: "_" },
    { content: "&" },
    { content: "-" },
    { content: "+" },
    { content: "(" },
    { content: ")" },
    { content: "/" },
  ],
  [
    { content: "*" },
    { content: ":" },
    { content: ";" },
    { content: "," },
    { content: "." },
    { content: "?" },
    { content: "!" },
    { content: "'" },
    { content: '"' },
    { content: "=" },
  ],
  [
    { content: "Ä" },
    { content: "Ö" },
    { content: "Ü" },
    { content: "ß" },
    { content: "{" },
    { content: "}" },
    { content: "[" },
    { content: "]" },
    { content: "°" },
    { content: "´" },
  ],
  [
    { content: "~" },
    { content: "Æ" },
    { content: "£" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
    { content: "" },
  ],
];

const baseLayers = {
  lowercase: lowercase,
  uppercase: uppercase,
  "symbols-lowercase": symbolsLowercase,
  "symbols-uppercase": symbolsUppercase,
};
