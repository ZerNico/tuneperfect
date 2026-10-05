import * as i18n from "@solid-primitives/i18n";
import { createMemo, createSignal } from "solid-js";

import * as de from "~/i18n/de";
import * as en from "~/i18n/en";
import { settingsStore } from "~/stores/settings";

// A signal so edited dictionaries can be swapped in during development (see the HMR block below).
const [dictionaries, setDictionaries] = createSignal({
  en: en.dict,
  de: de.dict,
});
type Locale = keyof ReturnType<typeof dictionaries>;
type Dictionary = i18n.Flatten<en.Dict>;

const getDictionary = (locale: Locale): Dictionary => i18n.flatten(dictionaries()[locale]) as Dictionary;

const locale = createMemo(() => {
  const locale = settingsStore.general().language;
  if (Object.keys(dictionaries()).includes(locale)) {
    return locale as Locale;
  }
  return "en";
});

const dict = createMemo(() => getDictionary(locale()));
// oxlint-disable-next-line solid/reactivity
const t = i18n.translator(dict, i18n.resolveTemplate);

// Swap translations in place when a dictionary file changes, instead of reloading the whole app.
if (import.meta.hot) {
  import.meta.hot.accept(["../i18n/en", "../i18n/de"], ([nextEn, nextDe]) => {
    setDictionaries((current) => ({ en: nextEn?.dict ?? current.en, de: nextDe?.dict ?? current.de }));
  });
}

export { t };
