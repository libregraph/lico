import allLocales from "./locales.json";

interface Locale {
  locale: string;
  name: string;
  nativeName: string;
}

// Every locale listed here is offered, whether or not it is fully translated.
// The i18n build passes --skipUntranslated, so a message without a translation
// is simply absent from the generated JSON and i18next falls back to en-GB for
// that key alone. A locale which gains a new untranslated string therefore
// renders partly in English rather than dropping out of the language picker.
// Filter here if that ever needs preventing.
export const locales: Locale[] = allLocales;

export default locales;
