import React, { Suspense, lazy } from 'react';

import CssBaseline from '@material-ui/core/CssBaseline';
import { MuiThemeProvider } from '@material-ui/core/styles';

import { IntlProvider } from 'react-intl';

import './App.css';
import './fancy-background.css';
import LoadingMessage from './components/LoadingMessage';
import * as version from './version';
import theme from './theme';

const LazyMain = lazy(() => import(/* webpackChunkName: "identifier-main" */ './Main'));

console.info(`Kopano Identifier build version: ${version.build}`); // eslint-disable-line no-console

class App extends React.PureComponent {
  render() {
    return (
      <IntlProvider locale="en-GB" onError={(err)=> {
        if (err.code === 'MISSING_TRANSLATION') {
          return;
        }
        throw err;
      }}>
        <MuiThemeProvider theme={theme}>
          <CssBaseline/>
          <Suspense fallback={<LoadingMessage/>}>
            <LazyMain />
          </Suspense>
        </MuiThemeProvider>
      </IntlProvider>
    );
  }
}

export default App;
