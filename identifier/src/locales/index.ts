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

/*
 * Returns the first wanted locale which is supported, preferring an exact match
 * and then one sharing the primary language, or null when none fits. Both lists
 * are in preference order, most preferred first.
 *
 * i18next's own matcher cannot be used for this: it cannot be scoped to a
 * subset of locales, because its language utilities capture the supported list
 * when they are constructed, so narrowing it afterwards has no effect and would
 * mutate options shared with the rest of the application. The lists here are
 * per call anyway — the language picker matches against the locales branding
 * enables, and a scope's translations against the ones its definition carries.
 */
export function bestSupportedLocale(wanted: readonly string[], supported: readonly string[]): string | null {
  const lower = supported.map((locale) => locale.toLowerCase());

  for (const code of wanted) {
    const exact = lower.indexOf(code.toLowerCase());
    if (exact !== -1) {
      return supported[exact];
    }

    const primary = code.split("-")[0].toLowerCase();
    const related = supported.find((locale) => locale.toLowerCase().split("-")[0] === primary);
    if (related) {
      return related;
    }
  }

  return null;
}

export default locales;
