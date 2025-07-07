import React, { useCallback, useMemo, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import { MenuItem, Select, SelectChangeEvent, SelectProps } from '@mui/material';

import allLocales from '../locales';

interface LocaleSelectProps {
  locales?: string[];
}

function LocaleSelect({ locales: localesProp }: LocaleSelectProps = {}) {
  const { i18n, ready } = useTranslation();

  const handleChange = useCallback((event: any) => {
    i18n.changeLanguage(event.target.value);
  }, [ i18n ]);

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
      // Simplified language detection - just use the first locale if current not supported
      const best = locales[0]?.locale;

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
    variant="standard"
    disableUnderline
    sx={{ 
      '& .MuiSelect-select': {
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: '24px !important',
        fontSize: '0.875rem',
      },
      '& .MuiSelect-icon': {
        right: 0,
      },
      '&:before': {
        display: 'none',
      },
      '&:after': {
        display: 'none',
      }
    }}
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
