import { t } from "~/lib/i18n";
import Menu, { type MenuItem } from "../menu";

interface PauseMenuProps {
  onClose?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
  class?: string;
  gradient?: "gradient-sing" | "gradient-party";
}

export default function PauseMenu(props: PauseMenuProps) {
  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("game.pause.resume"),
      action: () => props.onClose?.(),
    },
    {
      type: "button",
      label: t("game.pause.restart"),
      action: () => props.onRestart?.(),
    },
    {
      type: "button",
      label: t("game.pause.exit"),
      action: () => props.onExit?.(),
    },
  ];

  return (
    <div
      class="h-full w-full p-16"
      classList={{
        [props.class || ""]: true,
      }}
    >
      <Menu items={menuItems} layer={1} gradient={props.gradient} />
    </div>
  );
}
