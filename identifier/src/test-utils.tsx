/*
 * Shared helpers for the test suite. Imported only by tests, so this module
 * never enters the production module graph.
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Router } from 'react-router-dom';
import { createMemoryHistory, MemoryHistory } from 'history';
import { applyMiddleware, createStore, Store } from 'redux';
import thunkMiddleware from 'redux-thunk';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import rootReducer from './reducers';

/*
 * The common reducer reads the query string at module load, so its slice cannot
 * be influenced from a test by touching location. Tests preload it instead.
 */
export interface CommonState {
  hello: unknown;
  branding: unknown;
  error: unknown;
  flow: string;
  query: Record<string, string>;
  updateAvailable: boolean;
  pathPrefix: string;
}

export interface LoginState {
  loading: string;
  username: string;
  password: string;
  errors: Record<string, Error>;
}

export const defaultCommonState: CommonState = {
  hello: null,
  branding: null,
  error: null,
  flow: '',
  query: {},
  updateAvailable: false,
  pathPrefix: '/signin/v1'
};

export const defaultLoginState: LoginState = {
  loading: '',
  username: '',
  password: '',
  errors: {}
};

export interface PreloadedState {
  common?: Partial<CommonState>;
  login?: Partial<LoginState>;
}

/*
 * makeStore builds an isolated store. The application's own store is a module
 * level singleton, which would leak state between tests.
 */
export function makeStore(preloaded: PreloadedState = {}): Store {
  const preloadedState = {
    common: { ...defaultCommonState, ...preloaded.common },
    login: { ...defaultLoginState, ...preloaded.login }
  };

  // The reducers are still JavaScript, so TypeScript infers their default
  // state literally: hello, branding and error come out as null rather than as
  // the payloads they later hold. The cast goes away with Phase 3.
  return createStore(
    rootReducer,
    preloadedState as unknown as undefined,
    applyMiddleware(thunkMiddleware)
  );
}

/*
 * An i18next instance with no resources. Every t() call in the application
 * passes an English default as its second argument, and i18next returns that
 * default for a missing key, so assertions can use the text a user would read.
 *
 * The language detector plugin is registered because LocaleSelect reaches into
 * it directly (LocaleSelect.jsx:37-41) to resolve the browser's best matching
 * locale. Without it that component throws rather than rendering.
 *
 * The default language is en-GB, not en, because that is what the application
 * ships in src/locales/locales.json and what it falls back to.
 */
let testI18n: typeof i18n | undefined;

export function getTestI18n(): typeof i18n {
  if (!testI18n) {
    const instance = i18n.createInstance();
    instance
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        lng: 'en-GB',
        fallbackLng: false,
        supportedLngs: false,
        resources: {},
        interpolation: { escapeValue: false },
        detection: { order: ['navigator'], caches: [] }
      });
    testI18n = instance as unknown as typeof i18n;
  }
  return testI18n;
}

/*
 * setTestLanguages overrides what the navigator detector reports, so a test can
 * assert which locale the application picks for a given browser preference.
 * Returns a restore function.
 */
export function setTestLanguages(languages: string[]): () => void {
  const nav = window.navigator;
  const previous = {
    languages: Object.getOwnPropertyDescriptor(nav, 'languages'),
    language: Object.getOwnPropertyDescriptor(nav, 'language')
  };

  Object.defineProperty(nav, 'languages', { value: languages, configurable: true });
  Object.defineProperty(nav, 'language', { value: languages[0], configurable: true });

  return () => {
    if (previous.languages) {
      Object.defineProperty(nav, 'languages', previous.languages);
    }
    if (previous.language) {
      Object.defineProperty(nav, 'language', previous.language);
    }
  };
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: Store;
  preloaded?: PreloadedState;
  /* Initial URL for the router. Ignored when history is given. */
  route?: string;
  /* Supply a history to assert on navigation, or to control history.action. */
  history?: MemoryHistory;
}

export interface RenderWithProvidersResult extends RenderResult {
  store: Store;
  history?: MemoryHistory;
}

/*
 * renderWithProviders mounts a subject inside the providers the application
 * supplies in production: the redux store, i18next and a router.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderWithProvidersResult {
  const { store: givenStore, preloaded, route = '/', history, ...rest } = options;
  const store = givenStore ?? makeStore(preloaded);
  const instance = getTestI18n();

  const wrapper = ({ children }: { children?: React.ReactNode }) => {
    const routed = history ? (
      <Router history={history}>{children}</Router>
    ) : (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    );

    return (
      <Provider store={store}>
        <I18nextProvider i18n={instance}>{routed}</I18nextProvider>
      </Provider>
    );
  };

  return { ...render(ui, { wrapper, ...rest }), store, history };
}

/*
 * newTestHistory returns a memory history. Pass action 'REPLACE' or 'POP' to
 * exercise the code paths which branch on how the user arrived.
 */
export function newTestHistory(url = '/', action?: 'PUSH' | 'REPLACE' | 'POP'): MemoryHistory {
  const h = createMemoryHistory({ initialEntries: [url] });
  if (action) {
    // history sets action from the last operation; force it for the guards
    // which distinguish a client side navigation from a fresh page load.
    Object.defineProperty(h, 'action', { value: action, configurable: true, writable: true });
  }
  return h;
}

/*
 * Minimal shapes of the identifier API responses, per
 * docs/libregraph-connect-api-v1.yaml. Typing the fixtures is where the value
 * of TypeScript sits in this phase, since the components are still JavaScript.
 */
export interface Branding {
  bannerLogo?: string;
  bannerLogoHeight?: string;
  signinPageText?: string;
  usernameHintText?: string;
  signinPageLogoURI?: string;
  locales?: string[];
}

export interface ClientDetails {
  id: string;
  display_name: string;
  redirect_uri: string;
  trusted: boolean;
}

export interface ScopeDefinition {
  priority?: number;
  description?: string;
  id?: string;
}

export interface ScopesMeta {
  mapping: Record<string, string>;
  definitions: Record<string, ScopeDefinition>;
}

export interface HelloResponse {
  state: string;
  flow: string;
  success: boolean;
  username?: string;
  displayName?: string;
  next?: string;
  continue_uri?: string;
  scopes?: Record<string, boolean>;
  client?: ClientDetails;
  meta?: { scopes: ScopesMeta };
  branding?: Branding;
}

export interface LogonResponse {
  success: boolean;
  state: string;
  hello: HelloResponse | null;
}

export interface StateResponse {
  success: boolean;
  state: string;
}
