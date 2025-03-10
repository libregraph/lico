import React, { useCallback, useMemo, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import MenuItem from '@material-ui/core/MenuItem';
import Select, { SelectProps } from '@material-ui/core/Select';

import allLocales from '../locales';
import I18nextBrowserLanguageDetector from 'i18next-browser-languagedetector';


interface LocaleSelectProps extends SelectProps {
  locales?: string[],

}


const LocaleSelect: React.FC<LocaleSelectProps> = ({ locales: localesProp, ...other } = {}) => {
  const { i18n, ready } = useTranslation();

  const handleChange = useCallback((event) => {
    i18n.changeLanguage(event.target.value);
  }, [i18n])

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
    if (locales) {
      const found = locales.find((locale) => {
        return locale.locale === i18n.language;
      });
      if (found) {
        // Have language -> is supported all good.
        return;
      }

      const detector = i18n.modules.languageDetector as I18nextBrowserLanguageDetector;

      const wanted = detector.detectors.navigator.lookup();
      detector.services.languageUtils.options.supportedLngs = locales.map(locale => locale.locale);
      detector.services.languageUtils.options.fallbackLng = null;

      let best = detector.services.languageUtils.getBestMatchFromCodes(wanted);
      if (!best) {
        best = locales[0].locale;
      }

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
