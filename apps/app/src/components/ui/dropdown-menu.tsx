import { DropdownMenu as KDropdownMenu } from "@kobalte/core/dropdown-menu";
import type { JSX } from "solid-js";

interface DropdownMenuProps {
  children: JSX.Element;
  trigger: JSX.Element;
}

function DropdownMenuRoot(props: DropdownMenuProps) {
  return (
    <KDropdownMenu gutter={8} placement="bottom-end">
      {props.trigger}
      <KDropdownMenu.Portal>
        <KDropdownMenu.Content class="z-20 min-w-36 rounded-md bg-white p-1 shadow-lg focus:outline-slate-800">
          {props.children}
        </KDropdownMenu.Content>
      </KDropdownMenu.Portal>
    </KDropdownMenu>
  );
}

interface DropdownMenuItemProps {
  children: JSX.Element;
  onClick?: () => void;
  class?: string;
}

function DropdownMenuItem(props: DropdownMenuItemProps) {
  return (
    <KDropdownMenu.Item
      class="flex w-full cursor-pointer items-center gap-2 rounded px-4 py-2 text-sm transition-colors hover:bg-black/10 focus:outline-slate-800"
      classList={{
        [props.class ?? ""]: true,
      }}
      as="button"
      onClick={props.onClick}
    >
      {props.children}
    </KDropdownMenu.Item>
  );
}

const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: KDropdownMenu.Trigger,
  Item: DropdownMenuItem,
});

export default DropdownMenu;
