import { Menu } from "base-ui-solid/menu";
import type { Element } from "solid-js";

interface DropdownMenuProps {
  children: Element;
  trigger: Element;
}

function DropdownMenuRoot(props: DropdownMenuProps) {
  return (
    <Menu.Root modal={false}>
      {props.trigger}
      <Menu.Portal>
        <Menu.Positioner class="z-20 outline-none" side="bottom" align="end" sideOffset={8}>
          <Menu.Popup class="min-w-44 origin-(--transform-origin) rounded-[14px] surface-raised p-1.5 text-white transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {props.children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

interface DropdownMenuItemProps {
  children: Element;
  onSelect?: () => void;
  class?: string;
}

function DropdownMenuItem(props: DropdownMenuItemProps) {
  return (
    <Menu.Item
      class={[
        "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 font-semibold transition-colors outline-none hover:bg-white/10 data-highlighted:bg-white/10",
        props.class,
      ]}
      onClick={() => props.onSelect?.()}
    >
      {props.children}
    </Menu.Item>
  );
}

const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: Menu.Trigger,
  Item: DropdownMenuItem,
});

export default DropdownMenu;
