import React, { useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';

import { useTranslation } from 'react-i18next';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

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
function bestSupportedLocale(wanted, supported) {
  const lower = supported.map(locale => locale.toLowerCase());
  const find = (code) => {
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
function browserLanguages() {
  const { languages, language } = window.navigator;
  if (languages && languages.length > 0) {
    return languages;
  }
  return language ? [language] : [];
}

function LocaleSelect({ locales: localesProp, ...other } = {}) {
  const { i18n, ready } = useTranslation();

  const handleChange = useCallback((event) => {
    i18n.changeLanguage(event.target.value);
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

LocaleSelect.propTypes = {
  locales: PropTypes.arrayOf(PropTypes.string),
};

export default LocaleSelect;
