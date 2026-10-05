import type { JSX } from "solid-js";

import Plate, { type PlateProps } from "./plate";

interface MenuRowProps extends Omit<PlateProps, "children" | "contentClass"> {
  label: JSX.Element;
  /** The control: a value with arrows, a slider track, an input… */
  children: JSX.Element;
}

/** A labelled menu row: label on the left, control on the right, on a `Plate`. */
export default function MenuRow(props: MenuRowProps) {
  return (
    <Plate {...props} contentClass="grid grid-cols-[2fr_3fr] items-center gap-8 px-10">
      <div class="truncate text-xl font-bold">{props.label}</div>
      <div class="flex min-w-0 items-center">{props.children}</div>
    </Plate>
  );
}
