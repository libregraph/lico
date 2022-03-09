#!/usr/bin/env node

const cldr = require('cldr');

if (process.argv.length < 4) {
  throw new Error('usage error: at least 2 arguments are required!');
}

const output = process.argv[2];
const pos = process.argv.slice(3);

const englishLanguageDisplayNames = cldr.extractLanguageDisplayNames('en');
const englishTerritoryDisplayNames = cldr.extractTerritoryDisplayNames('en');

function localeCapitalize(s, locale) {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

function Locale(locale, overrides={}) {
  const [code, country] = locale.split('-', 2);

  const languageDisplayNames = cldr.extractLanguageDisplayNames(code);
  if (languageDisplayNames) {
    let name = localeCapitalize(englishLanguageDisplayNames[code], 'en');
    let nativeName = localeCapitalize(languageDisplayNames[code], code);
    if (name && nativeName) {
      if (country) {
        let countryNative = localeCapitalize(cldr.extractTerritoryDisplayNames(code)[country], code);
        nativeName = `${nativeName} (${countryNative})`;
        name = `${name} (${localeCapitalize(englishTerritoryDisplayNames[country], 'en')})`;
      }
      return {
        locale,
        name,
        nativeName,
        ...cldr.extractLayout(code),
        ...overrides,
      }
    }
  }
}

var locales = [
  Locale('en-GB', { name: 'English', nativeName: 'English' }), // Always add en-GB as English.
]

pos.map((po) => {
  const locale = Locale(po.replace(/\.[^/.]+$/, ''));
  if (locale) {
    locales.push(locale);
  }
});

locales.sort((a, b) => {
  return a.locale > b.locale ? 1 : -1;
})

require('fs').writeFileSync(output, JSON.stringify(locales, null, 2));
