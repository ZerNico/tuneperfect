import { DropdownMenu as KDropdownMenu } from "@kobalte/core/dropdown-menu";
import type { JSX } from "solid-js";

interface DropdownMenuProps {
  children: JSX.Element;
  trigger: JSX.Element;
}

function DropdownMenuRoot(props: DropdownMenuProps) {
  return (
    <KDropdownMenu gutter={8} placement="bottom-end" modal={false}>
      {props.trigger}
      <KDropdownMenu.Portal>
        <KDropdownMenu.Content class="z-20 min-w-44 rounded-[14px] surface-raised p-1.5 text-white focus:outline-none">
          {props.children}
        </KDropdownMenu.Content>
      </KDropdownMenu.Portal>
    </KDropdownMenu>
  );
}

interface DropdownMenuItemProps {
  children: JSX.Element;
  onSelect?: () => void;
  class?: string;
}

function DropdownMenuItem(props: DropdownMenuItemProps) {
  return (
    <KDropdownMenu.Item
      class="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 font-semibold transition-colors hover:bg-white/10 focus:outline-none data-[highlighted]:bg-white/10"
      classList={{
        [props.class ?? ""]: true,
      }}
      onSelect={props.onSelect}
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
