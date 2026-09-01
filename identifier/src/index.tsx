import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import './i18n';

import App from './App';
import store from './store';

/*
 * The nonce the server wrote into the document. Emotion does not look for this
 * tag the way v4's JSS did, so it has to be handed the value or the style
 * elements it injects are refused by the style-src policy.
 *
 * An unsubstituted placeholder is rejected along with an absent tag: it means
 * nobody is enforcing a policy, and passing the literal through would put a
 * bogus nonce on every style element instead of none.
 */
const getNonce = (): string | undefined => {
  const nonce = document
    .querySelector('meta[property="csp-nonce"]')
    ?.getAttribute('content');

  return nonce && nonce !== '__CSP_NONCE__' ? nonce : undefined;
};

/*
 * prepend puts the generated styles ahead of the stylesheets App imports, so
 * those keep overriding them, which is what the engine provider would otherwise
 * be needed for.
 */
const cache = createCache({
  key: 'mui',
  nonce: getNonce(),
  prepend: true,
});

ReactDOM.render(
  <React.StrictMode>
    <CacheProvider value={cache}>
      <Provider store={store}>
        <App/>
      </Provider>
    </CacheProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
