import React, { Suspense, lazy, useEffect, useState } from 'react';

import { MuiThemeProvider } from '@material-ui/core/styles';
import {
  CssBaseline,
 } from '@material-ui/core';

import { IntlProvider } from 'react-intl';

import './App.css';
import './fancy-background.css';
import Spinner from './components/Spinner';
import * as version from './version';
import theme from './theme';

const LazyMain = lazy(() => import(/* webpackChunkName: "identifier-main" */ './Main'));

console.info(`Kopano Identifier build version: ${version.build}`); // eslint-disable-line no-console

async function loadLocaleData(locale) {
  switch (locale) {
  default:
    return import(/* webpackChunkName: "identifier-locale-en" */ './locales/en.json');
  }
}

const App = ({ locale }) => {
  const [ messages, setMessages ] = useState(null);
  useEffect(() => {
    async function fetchLocaleData() {
      const data = await loadLocaleData(locale);
      setMessages(data);
    }
    fetchLocaleData();
  }, [locale]);

  const elem = messages === null ? <Spinner/> : (<IntlProvider defaultLocale="en" locale={locale} messages={messages}>
    <Suspense fallback={<Spinner/>}>
      <LazyMain />
    </Suspense>
  </IntlProvider>);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline/>
      {elem}
    </MuiThemeProvider>
  );
}

App.defaultProps= {
  locale: 'en',
};

export default App;
