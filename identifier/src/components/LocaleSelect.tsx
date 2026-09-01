import { useCallback, useMemo, useEffect } from 'react';
import type React from 'react';

import { useTranslation } from 'react-i18next';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import type { SelectProps } from '@material-ui/core/Select';

import allLocales from '../locales';

/*
 * Returns the first supported locale the browser asks for, preferring an exact
 * match and then one sharing the primary language, or null when none fits.
 *
 * i18next's own matcher cannot be scoped to a subset of locales: its language
 * utilities capture the supported list when they are constructed, so narrowing
 * it afterwards has no effect and would mutate options shared with the rest of
 * the application.
 */
function bestSupportedLocale(wanted: readonly string[], supported: readonly string[]): string | null {
  const lower = supported.map(locale => locale.toLowerCase());
  const find = (code: string): string | null => {
    const index = lower.indexOf(code.toLowerCase());
    return index === -1 ? null : supported[index];
  };

  for (const code of wanted) {
    const exact = find(code);
    if (exact) {
      return exact;
    }

    const primary = code.split('-')[0].toLowerCase();
    const related = supported.find(locale => locale.toLowerCase().split('-')[0] === primary);
    if (related) {
      return related;
    }
  }

  return null;
}

/* The languages the browser reports, most preferred first. */
function browserLanguages(): readonly string[] {
  const { languages, language } = window.navigator;
  if (languages && languages.length > 0) {
    return languages;
  }
  return language ? [language] : [];
}

export interface LocaleSelectProps extends Omit<SelectProps, 'value' | 'onChange'> {
  // The locale codes the branding enables. Every shipped locale is offered when
  // this is absent.
  locales?: string[];
}

function LocaleSelect({ locales: localesProp, ...other }: LocaleSelectProps = {}) {
  const { i18n, ready } = useTranslation();

  const handleChange = useCallback((event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    // Every menu item below carries a locale code as its value.
    i18n.changeLanguage(event.target.value as string);
  }, [ i18n ])

  const locales = useMemo(() => {
    if (!localesProp) {
      return allLocales;
    }
    const supported = allLocales.filter(locale => {
      return localesProp.includes(locale.locale);
    });
    return supported;
  }, [localesProp]);

  useEffect(() => {
    // An empty list is possible: the branding may enable only locales this build
    // does not ship, and filtering then leaves nothing to choose from.
    if (locales && locales.length > 0) {
      const codes = locales.map(locale => locale.locale);
      if (codes.includes(i18n.language)) {
        // Have language -> is supported all good.
        return;
      }

      const best = bestSupportedLocale(browserLanguages(), codes) || codes[0];

      // Auto change language to best one found if the current selected one is not enabled.
      if (i18n.language !== best) {
        i18n.changeLanguage(best);
      }
    }
  }, [i18n, locales]);

  if (!ready || !locales || locales.length < 2) {
    return null;
  }

  return <Select
    value={i18n.language}
    onChange={handleChange}
    {...other}
  >
    {locales.map(language => {
      return <MenuItem
        key={language.locale}
        value={language.locale}>
        {language.nativeName}
      </MenuItem>;
    })}
  </Select>;
}

export default LocaleSelect;
