import IconFilter from "~icons/ph/sliders-horizontal-bold";
import IconF4Key from "~icons/sing/f4-key";
import IconGamepadY from "~icons/sing/gamepad-y";

import { t } from "~/lib/i18n";

import ChipButton from "../ui/chip-button";
import KeyGlyph from "../ui/key-glyph";

interface FilterButtonProps {
  onClick: () => void;
}

export function FilterButton(props: FilterButtonProps) {
  return (
    <ChipButton
      icon={IconFilter}
      label={t("sing.filter.title")}
      hint={<KeyGlyph keyboard={IconF4Key} gamepad={IconGamepadY} />}
      onClick={() => props.onClick()}
    >
      {t("sing.filter.title")}
    </ChipButton>
  );
}
