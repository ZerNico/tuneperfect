import * as i18n from "@solid-primitives/i18n";
import { createMemo } from "solid-js";
import * as de from "~/i18n/de";
import * as en from "~/i18n/en";
import { settingsStore } from "~/stores/settings";

const dictionaries = {
  en: en.dict,
  de: de.dict,
};
export type Locale = keyof typeof dictionaries;
export type Dictionary = i18n.Flatten<en.Dict>;

const getDictionary = (locale: Locale): Dictionary => i18n.flatten(dictionaries[locale]) as Dictionary;

const locale = createMemo(() => {
  const locale = settingsStore.general().language;
  if (Object.keys(dictionaries).includes(locale)) {
    return locale as Locale;
  }
  return "en";
});

const dict = createMemo(() => getDictionary(locale()));
const t = i18n.translator(dict, i18n.resolveTemplate);

const setLocale = (lang: Locale) => {
  settingsStore.saveGeneral({ ...settingsStore.general(), language: lang });
};

export { t, setLocale, locale, dict };
