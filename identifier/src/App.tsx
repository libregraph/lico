import React, { Suspense, lazy } from 'react';

import { ThemeProvider } from '@mui/material/styles';
import {
  CssBaseline,
 } from '@mui/material';

import './App.css';
import './fancy-background.css';
import Spinner from './components/Spinner';
import * as version from './version';
import theme from './theme';

const LazyMain = lazy(() => import(/* webpackChunkName: "identifier-main" */ './Main'));

console.info(`Kopano Identifier build version: ${version.build}`); // eslint-disable-line no-console

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Suspense fallback={<Spinner/>}>
        <LazyMain />
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
