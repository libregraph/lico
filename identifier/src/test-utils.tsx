/*
 * Shared helpers for the test suite. Imported only by tests, so this module
 * never enters the production module graph.
 */

import type React from "react";
import { useEffect, useRef } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import type { Location, NavigateFunction, NavigationType } from "react-router";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router";

import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import i18n from "i18next";
import type { Mock } from "vitest";

import type { FlowNavigation } from "./hooks/navigation";
import type { CommonState } from "./reducers/common";
import type { LoginState } from "./reducers/login";
import type { SignInRequest } from "./request";
import { DEFAULT_PATH_PREFIX, PathPrefixProvider, SignInRequestProvider } from "./request";
import type { AppStore, RootState } from "./store";
import { setupStore } from "./store";

/*
 * The domain types live with the code that produces them. They are re-exported
 * here because the tests reach for them alongside these helpers.
 */
export type {
  Branding,
  ClientDetails,
  FieldErrors,
  HelloResponse,
  LogonResponse,
  ScopeDefinition,
  ScopesMeta,
  Session,
  StateResponse,
} from "./models/api";
export type { CommonState } from "./reducers/common";
export type { LoginState } from "./reducers/login";
export type { SignInRequest } from "./request";

export const defaultCommonState: CommonState = {
  hello: null,
  branding: null,
  error: null,
};

export const defaultLoginState: LoginState = {
  loading: "",
  errors: {},
};

/*
 * What the request would have asked for. This is a dependency rather than
 * state, so a test hands it in whole instead of preloading it into a slice.
 */
export const defaultSignInRequest: SignInRequest = {
  flow: "",
  query: {},
};

export interface PreloadedState {
  common?: Partial<CommonState>;
  login?: Partial<LoginState>;
}

/*
 * The store a test drives. Dispatch has to accept the thunks the action
 * creators return, which is what the thunk middleware below contributes.
 */
export type TestStore = AppStore;

/*
 * makeStore builds an isolated store, so state cannot leak between tests.
 */
export function makeStore(preloaded: PreloadedState = {}, request: Partial<SignInRequest> = {}): TestStore {
  const preloadedState: RootState = {
    common: { ...defaultCommonState, ...preloaded.common },
    login: { ...defaultLoginState, ...preloaded.login },
  };

  return setupStore({ ...defaultSignInRequest, ...request }, preloadedState);
}

/*
 * An i18next instance with no resources. Every t() call in the application
 * passes an English default as its second argument, and i18next returns that
 * default for a missing key, so assertions can use the text a user would read.
 *
 * The default language is en-GB, not en, because that is what the application
 * ships in src/locales/locales.json and what it falls back to.
 */
let testI18n: typeof i18n | undefined;

export function getTestI18n(): typeof i18n {
  if (!testI18n) {
    const instance = i18n.createInstance();
    instance.use(initReactI18next).init({
      lng: "en-GB",
      fallbackLng: false,
      supportedLngs: false,
      resources: {},
      interpolation: { escapeValue: false },
      detection: { order: ["navigator"], caches: [] },
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
    languages: Object.getOwnPropertyDescriptor(nav, "languages"),
    language: Object.getOwnPropertyDescriptor(nav, "language"),
  };

  Object.defineProperty(nav, "languages", { value: languages, configurable: true });
  Object.defineProperty(nav, "language", { value: languages[0], configurable: true });

  return () => {
    if (previous.languages) {
      Object.defineProperty(nav, "languages", previous.languages);
    }
    if (previous.language) {
      Object.defineProperty(nav, "language", previous.language);
    }
  };
}

/*
 * What the tests assert about navigation. There is no history object to inspect
 * in react-router 8, so the router itself is asked: every location it settles
 * on is recorded together with the navigation type that produced it.
 *
 * entries reconstructs the stack from those types, which is what makes "this
 * redirect replaced rather than pushed" assertable: a push grows the stack, a
 * replace substitutes its last entry. Back and forward are not modelled,
 * because nothing here drives them.
 */
export interface TestNavigation {
  location: Location;
  action: `${NavigationType}`;
  entries: Location[];
  navigate: NavigateFunction;
}

/*
 * The route the harness starts on when a test wants the subject to be reached
 * by an in-app navigation. It is never recorded, and no route matches it, so it
 * cannot be mistaken for something the subject did.
 */
const ARRIVAL_ROUTE = "/__test-arrival";

class NavigationRecorder implements TestNavigation {
  entries: Location[] = [];
  navigate: NavigateFunction = () => {
    throw new Error("the router has not mounted yet");
  };

  // Set when the harness has to navigate to reach the subject: recording waits
  // for that arrival, so the scaffolding stays out of the stack.
  constructor(private readonly awaiting?: string) {}

  get location(): Location {
    const last = this.entries[this.entries.length - 1];
    if (!last) {
      throw new Error("no location was recorded");
    }
    return last;
  }

  action: `${NavigationType}` = "POP";

  record(location: Location, action: `${NavigationType}`): void {
    if (this.entries.length === 0 && this.awaiting && location.pathname !== this.awaiting) {
      return;
    }
    if (this.entries.length > 0 && location.key === this.location.key) {
      return;
    }

    this.action = action;
    if (this.entries.length === 0 || action !== "PUSH") {
      this.entries.splice(Math.max(this.entries.length - 1, 0), 1, location);
      return;
    }
    this.entries.push(location);
  }
}

const Recorder = ({ into }: { into: NavigationRecorder }) => {
  const location = useLocation();
  const action = useNavigationType();
  const navigate = useNavigate();

  into.navigate = navigate;

  useEffect(() => {
    into.record(location, action);
  }, [into, location, action]);

  return null;
};

/* Navigates once, so the subject mounts as the target of a real navigation. */
const Arrival = ({ to, replace }: { to: string; replace: boolean }) => {
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) {
      return;
    }
    done.current = true;
    navigate(to, { replace });
  }, [navigate, to, replace]);

  return null;
};

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  store?: TestStore;
  preloaded?: PreloadedState;
  /* Initial URL for the router. */
  route?: string;
  /* What the screen was asked to sign in for, which is not state. */
  request?: Partial<SignInRequest>;
  /*
   * Reach `route` by navigating rather than by loading it. The screens which
   * decide on mount whether they were reached from inside the app read exactly
   * this difference; a fresh load reports POP, which is the default here.
   */
  arriveBy?: "PUSH" | "REPLACE";
}

export interface RenderWithProvidersResult extends RenderResult {
  store: TestStore;
  nav: TestNavigation;
}

/*
 * renderWithProviders mounts a subject inside the providers the application
 * supplies in production: the redux store, i18next and a router.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { store: givenStore, preloaded, request, route = "/", arriveBy, ...rest } = options;
  const store = givenStore ?? makeStore(preloaded, request);
  const wholeRequest: SignInRequest = { ...defaultSignInRequest, ...request };
  const instance = getTestI18n();
  const nav = new NavigationRecorder(arriveBy ? new URL(route, "http://test").pathname : undefined);

  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <SignInRequestProvider value={wholeRequest}>
      <PathPrefixProvider value={DEFAULT_PATH_PREFIX}>
        <Provider store={store}>
          <I18nextProvider i18n={instance}>
            <MemoryRouter initialEntries={[arriveBy ? ARRIVAL_ROUTE : route]}>
              <Recorder into={nav} />
              {arriveBy ? (
                <Routes>
                  <Route path={ARRIVAL_ROUTE} element={<Arrival to={route} replace={arriveBy === "REPLACE"} />} />
                  <Route path="*" element={children} />
                </Routes>
              ) : (
                children
              )}
            </MemoryRouter>
          </I18nextProvider>
        </Provider>
      </PathPrefixProvider>
    </SignInRequestProvider>
  );

  return { ...render(ui, { wrapper, ...rest }), store, nav };
}

/*
 * For a subject which mounts a router of its own. react-router 8 refuses to
 * nest one router inside another, so the harness has to stay out of the way and
 * the subject decides what the location means.
 */
export function renderWithoutRouter(
  ui: React.ReactElement,
  options: Omit<RenderWithProvidersOptions, "route" | "arriveBy"> = {},
): RenderResult & { store: TestStore } {
  const { store: givenStore, preloaded, request, ...rest } = options;
  const store = givenStore ?? makeStore(preloaded, request);
  const instance = getTestI18n();

  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <SignInRequestProvider value={{ ...defaultSignInRequest, ...request }}>
      <PathPrefixProvider value={DEFAULT_PATH_PREFIX}>
        <Provider store={store}>
          <I18nextProvider i18n={instance}>{children}</I18nextProvider>
        </Provider>
      </PathPrefixProvider>
    </SignInRequestProvider>
  );

  return { ...render(ui, { wrapper, ...rest }), store };
}

export interface TestArrival {
  route: string;
  arriveBy?: "PUSH" | "REPLACE";
}

/*
 * How the subject was reached, spread into renderWithProviders. A fresh page
 * load is the default because that is what the router reports for one, and it
 * is the case the mount-time guards are there to catch.
 */
export function arriveAt(url = "/", action: `${NavigationType}` = "POP"): TestArrival {
  return action === "POP" ? { route: url } : { route: url, arriveBy: action };
}

export interface TestFlowNavigation extends FlowNavigation {
  /* The stack, so a replace can be told from a push. */
  entries: Location[];
}

/*
 * A navigation for the thunks, which are handed one instead of calling the
 * router's hooks themselves. It records where it was sent the way the router
 * would: a push grows the stack, a replace substitutes its last entry.
 *
 * navigationType is an input rather than an observation here - it is how the
 * caller says whether the screen dispatching this was loaded or navigated to,
 * which is the difference advanceLogonFlow branches on.
 */
export function newTestNavigation(url = "/", navigationType: `${NavigationType}` = "POP"): TestFlowNavigation {
  const at = (to: string): Location => {
    const parsed = new URL(to, "http://test");
    return {
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      state: null,
      key: `${Math.random()}`,
    };
  };

  const nav: TestFlowNavigation = {
    entries: [at(url)],
    navigationType,
    get location() {
      return nav.entries[nav.entries.length - 1];
    },
    navigate: ((to: unknown, options?: { replace?: boolean }) => {
      if (typeof to !== "string") {
        throw new Error(`the application only navigates to strings, got ${JSON.stringify(to)}`);
      }

      if (options?.replace) {
        nav.entries[nav.entries.length - 1] = at(to);
        nav.navigationType = "REPLACE";
        return;
      }

      nav.entries.push(at(to));
      nav.navigationType = "PUSH";
    }) as NavigateFunction,
  };

  return nav;
}

/*
 * The network stub. Every identifier endpoint is a POST whose body carries a
 * random state nonce, and the client rejects a reply which does not echo it, so
 * a stub has to read the nonce back out of the body it was handed.
 *
 * These build real Response objects rather than plain look-alikes, so the code
 * under test goes through the actual status, header and body-parsing paths. In
 * particular header lookups are case-insensitive here exactly as they are in a
 * browser.
 */
export function stubFetch(): void {
  vi.stubGlobal("fetch", vi.fn());
}

export function fetchMock(): Mock {
  const stubbed: unknown = globalThis.fetch;
  if (typeof stubbed !== "function" || !("mock" in stubbed)) {
    throw new Error("fetch is not stubbed: call stubFetch() first");
  }
  // Checked immediately above, which is all the shape a mock accessor needs.
  const mock = stubbed as Mock;
  return mock;
}

export function jsonReply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function sentState(init: RequestInit): string | undefined {
  // The body is whatever the code under test just serialized, so reading the
  // nonce back out of it needs no validation.
  const sent = JSON.parse(String(init.body)) as { state?: string };
  return sent.state;
}

/* Answers with the given status and body, echoing the request's state nonce. */
export function replyEchoingState(status: number, body: Record<string, unknown> = {}): void {
  fetchMock().mockImplementation((_url: string, init: RequestInit) =>
    Promise.resolve(jsonReply(status, { ...body, state: sentState(init) })),
  );
}

/* Answers 204, where the nonce comes back in a header because there is no body. */
export function replyNoContentEchoingState(): void {
  fetchMock().mockImplementation((_url: string, init: RequestInit) => {
    const state = sentState(init);
    return Promise.resolve(
      new Response(null, {
        status: 204,
        headers: state === undefined ? {} : { "Kopano-Konnect-State": state },
      }),
    );
  });
}

export function postedUrl(n = 0): string {
  return String(fetchMock().mock.calls[n][0]);
}

export function postedInit(n = 0): RequestInit {
  // fetch's second argument, as the code under test passed it.
  const init = fetchMock().mock.calls[n][1] as RequestInit;
  return init;
}

export function postedBody(n = 0): Record<string, unknown> {
  const body = JSON.parse(String(postedInit(n).body)) as Record<string, unknown>;
  return body;
}
