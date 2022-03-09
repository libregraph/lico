import React, { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import locales from '../locales';


function LocaleSelect({ ...other } = {}) {
  const { i18n } = useTranslation();

  const handleChange = useCallback((event) => {
    i18n.changeLanguage(event.target.value);
  }, [ i18n ])

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
