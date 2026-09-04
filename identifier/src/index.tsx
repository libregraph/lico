import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import "./i18n";

import App from "./App";
import { loadBackgroundImage } from "./boot";
import {
  PathPrefixProvider,
  readBackgroundImage,
  readPathPrefix,
  readSignInRequest,
  SignInRequestProvider,
} from "./request";
import { setupStore } from "./store";
import { makeTheme } from "./theme";

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
  const nonce = document.querySelector('meta[property="csp-nonce"]')?.getAttribute("content");

  return nonce && nonce !== "__CSP_NONCE__" ? nonce : undefined;
};

/*
 * prepend puts the generated styles ahead of the stylesheets App imports, so
 * those keep overriding them, which is what the engine provider would otherwise
 * be needed for.
 */
const cache = createCache({
  key: "mui",
  nonce: getNonce(),
  prepend: true,
});

const container = document.getElementById("root");
if (!container) {
  // The server writes this element, so its absence means the document the
  // webapp was served with is not the one it was built against.
  throw new Error("no #root element to render into");
}

/*
 * The one read of each: what this request asks for, off the URL it arrived on,
 * and where the webapp is served from, out of the element the server
 * substituted the prefix into. Everything downstream is handed the results
 * rather than reaching for the document again.
 */
const request = readSignInRequest(document.location.search);
const pathPrefix = readPathPrefix(container);
const backgroundImage = readBackgroundImage(container);
const store = setupStore(request);
const theme = makeTheme(pathPrefix, backgroundImage);

createRoot(container).render(
  <React.StrictMode>
    <CacheProvider value={cache}>
      <SignInRequestProvider value={request}>
        <PathPrefixProvider value={pathPrefix}>
          <Provider store={store}>
            <App theme={theme} />
          </Provider>
        </PathPrefixProvider>
      </SignInRequestProvider>
    </CacheProvider>
  </React.StrictMode>,
);

/*
 * Starts the background fetch behind the loading state. The state itself is
 * released from ./boot once this and the app are both ready.
 */
loadBackgroundImage(pathPrefix, backgroundImage);
