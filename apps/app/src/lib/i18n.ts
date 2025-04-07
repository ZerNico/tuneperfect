import * as i18n from "@solid-primitives/i18n";
import { makePersisted } from "@solid-primitives/storage";
import { createMemo, createSignal } from "solid-js";
import * as en from "~/i18n/en";

const dictionaries = {
  en: en.dict,
};
type Locale = keyof typeof dictionaries;
export type Dictionary = i18n.Flatten<en.Dict>;

function getDefaultLocale() {
  const browserLocales = navigator.languages;
  for (const locale of browserLocales) {
    if (Object.keys(dictionaries).includes(locale)) {
      return locale as Locale;
    }
  }
  return "en";
}

const getDictionary = (locale: Locale): Dictionary => i18n.flatten(dictionaries[locale]) as Dictionary;

const [locale, internalSetLocale] = makePersisted(createSignal<Locale>(getDefaultLocale()), {
  name: "locale",
});
const dict = createMemo(() => getDictionary(locale()));
const t = i18n.translator(dict, i18n.resolveTemplate);

const setLocale = (lang: Locale) => {
  internalSetLocale(lang);
};

export { t, setLocale, locale, dict };
