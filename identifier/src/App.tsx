import { Suspense, lazy } from 'react';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import './App.css';
import './fancy-background.css';
import Spinner from './components/Spinner';
import * as version from './version';
import theme from './theme';

const LazyMain = lazy(() => import('./Main'));

console.info(`Kopano Identifier build version: ${version.build}`);

/*
 * No StyledEngineProvider here: the emotion cache created in index.tsx is
 * built with prepend, which puts the generated styles ahead of the stylesheets
 * imported above so those can still override them.
 */
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
