import type { UnknownAction } from "@reduxjs/toolkit";

import {
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  type TranslatableError,
} from "../errors";
import { receiveError, receiveHello, resetHello } from "../reducers/common";
import { receiveLogoff } from "../reducers/login";
import { rootReducer } from "../store";
import {
  fetchMock,
  type HelloResponse,
  jsonReply,
  makeStore,
  type PreloadedState,
  postedBody,
  postedInit,
  postedUrl,
  replyEchoingState,
  replyNoContentEchoingState,
  type StateResponse,
  stubFetch,
} from "../test-utils";
import { executeHello, executeLogoff, retryHello } from "./common";

/*
 * makeStore builds its dispatch chain inside applyMiddleware, so replacing the
 * returned store.dispatch would only see the outermost call and miss whatever a
 * thunk dispatches. A wrapping reducer sees every plain action in order. This
 * helper is local on purpose, since src/test-utils.tsx is shared.
 */
function newHarness(preloaded: PreloadedState = {}) {
  const store = makeStore(preloaded);
  const actions: UnknownAction[] = [];

  store.replaceReducer((state, action) => {
    actions.push(action);
    return rootReducer(state, action);
  });
  actions.length = 0; // replaceReducer dispatches an init action of its own.

  return { store, actions };
}

/*
 * Reading a payload means establishing which action arrived. Each creator's own
 * matcher does that and narrows the type with it, so a test which dispatched
 * something else names what actually arrived rather than reading undefined and
 * failing later on an unrelated line.
 */
function receiveErrorAction(action: UnknownAction) {
  if (!receiveError.match(action)) {
    throw new Error(`expected ${receiveError.type}, dispatched was ${action.type}`);
  }
  return action;
}

function receiveLogoffAction(action: UnknownAction) {
  if (!receiveLogoff.match(action)) {
    throw new Error(`expected ${receiveLogoff.type}, dispatched was ${action.type}`);
  }
  return action;
}

/* The failure a reported error carries, which every test below expects to find. */
function reportedError(action: UnknownAction): TranslatableError {
  const { payload } = receiveErrorAction(action);
  if (payload === null) {
    throw new Error(`${receiveError.type} carried no error`);
  }
  return payload;
}

/*
 * The values interpolated into an error message. asError copies them off an
 * ExtendedError, so an error carrying none is not the error under test.
 */
function errorValues(error: TranslatableError | null): Record<string, unknown> {
  if (error?.values === undefined) {
    throw new Error(`expected an error carrying values, got ${String(error)}`);
  }
  return error.values;
}

beforeEach(() => {
  stubFetch();
});

describe("executeHello", () => {
  it("resets any existing hello before it asks the server", async () => {
    const { store, actions } = newHarness();
    let seenAtPost: string[] = [];
    fetchMock().mockImplementation((_url: string, init: RequestInit) => {
      seenAtPost = actions.map((a) => a.type);
      const sent = JSON.parse(String(init.body)) as { state?: string };
      return Promise.resolve(jsonReply(200, { success: false, state: sent.state }));
    });

    await store.dispatch(executeHello());

    expect(seenAtPost).toEqual([resetHello.type]);
  });

  it("posts to a page relative endpoint with the XSRF header", async () => {
    replyEchoingState(200, { success: false });
    const { store } = newHarness();

    await store.dispatch(executeHello());

    // The URL is relative to the page the identifier is served from, which is
    // what lets it work under any path prefix.
    expect(postedUrl()).toBe("./identifier/_/hello");
    expect(postedInit().method).toBe("POST");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });

  it("builds the posted body from the flow and query held in the store", async () => {
    replyEchoingState(200, { success: false });
    const { store } = newHarness({
      common: {
        flow: "oidc",
        query: {
          scope: "openid profile",
          client_id: "playground.js",
          redirect_uri: "https://app.test/callback",
          prompt: "consent",
        },
      },
    });

    await store.dispatch(executeHello());

    expect(postedBody()).toEqual({
      prompt: "consent",
      flow: "oidc",
      scope: "openid profile",
      client_id: "playground.js",
      redirect_uri: "https://app.test/callback",
      state: expect.any(String),
    });
  });

  it("posts only the state nonce when the store holds no recognised flow", async () => {
    replyEchoingState(200, { success: false });
    const { store } = newHarness();

    await store.dispatch(executeHello());

    expect(postedBody()).toEqual({ state: expect.any(String) });
  });

  it("dispatches the received hello and resolves with the response on a 200", async () => {
    const hello: Omit<HelloResponse, "state"> = {
      flow: "oidc",
      success: true,
      username: "user1@example.com",
      displayName: "Lala 123 abc",
      next: "consent",
    };
    replyEchoingState(200, { ...hello });
    const { store, actions } = newHarness({ common: { flow: "oidc" } });

    const response = await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveHello.type]);
    expect(actions[1]).toEqual({ type: receiveHello.type, payload: response });
    expect(response).toEqual({ ...hello, state: postedBody().state });
  });

  it("records a 200 with success false as not signed in", async () => {
    // The server answers a hello for an anonymous visitor with 200 and
    // success false, never with a 204.
    replyEchoingState(200, { success: false, flow: "oidc" });
    const { store, actions } = newHarness({ common: { flow: "oidc" } });

    const response = await store.dispatch(executeHello());

    expect(actions[1]).toEqual({ type: receiveHello.type, payload: response });
    expect(store.getState().common.hello?.state).toBe(false);
  });

  it("treats a 204 as an unexpected status, since hello never answers one", async () => {
    // The dead 204 arm this thunk used to carry was removed with the rewrite.
    replyNoContentEchoingState();
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(errorValues(reportedError(actions[1])).status).toBe(204);
  });

  it("reports a reply whose state does not echo the request", async () => {
    fetchMock().mockResolvedValue(jsonReply(200, { success: true, username: "attacker", state: "not-the-nonce" }));
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
    // A forged reply must never reach the session, and the error has to be
    // readable from the store since that is what the loading screen shows.
    expect(store.getState().common.error?.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
    expect(store.getState().common.hello).toBeNull();
  });

  it("reports an unexpected response status", async () => {
    // fetch resolves for a 500, so the thunk's own status switch is the only
    // thing that turns it into an error.
    fetchMock().mockResolvedValue(new Response("internal server error", { status: 500 }));
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(errorValues(reportedError(actions[1])).status).toBe(500);
  });

  it("carries only the status in the error, not the whole response", async () => {
    // The error is dispatched into the store, so it has to stay serializable.
    fetchMock().mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const { store } = newHarness();

    await store.dispatch(executeHello());

    expect(errorValues(store.getState().common.error)).toEqual({ status: 502 });
  });

  it("reports a request which never got a response as a network error", async () => {
    fetchMock().mockRejectedValue(new TypeError("Failed to fetch"));
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(store.getState().common.error?.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });

  it("stays silent when the caller aborts the request", async () => {
    // An abort is the caller's own doing. Reporting it as a network failure
    // would put an error on screen for a screen which is going away.
    fetchMock().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type]);
    expect(store.getState().common.error).toBeNull();
    expect(response).toBeUndefined();
  });

  it("passes an abort signal through to the request", async () => {
    replyEchoingState(200, { success: false });
    const controller = new AbortController();
    const { store } = newHarness();

    await store.dispatch(executeHello({ signal: controller.signal }));

    expect(postedInit().signal).toBe(controller.signal);
  });
});

describe("retryHello", () => {
  it("clears the standing error before it asks again", async () => {
    replyEchoingState(200, { success: true, username: "user1@example.com" });
    const { store, actions } = newHarness({
      common: { error: new Error(ERROR_HTTP_NETWORK_ERROR) },
    });

    const response = await store.dispatch(retryHello());

    expect(actions.map((a) => a.type)).toEqual([receiveError.type, resetHello.type, receiveHello.type]);
    expect(receiveErrorAction(actions[0]).payload).toBeNull();
    expect(store.getState().common.error).toBeNull();
    expect(response?.username).toBe("user1@example.com");
  });
});

describe("executeLogoff", () => {
  it("resets hello and announces the request before it posts", async () => {
    const { store, actions } = newHarness();
    let seenAtPost: string[] = [];
    fetchMock().mockImplementation((_url: string, init: RequestInit) => {
      seenAtPost = actions.map((a) => a.type);
      const sent = JSON.parse(String(init.body)) as { state?: string };
      return Promise.resolve(jsonReply(200, { success: true, state: sent.state }));
    });

    await store.dispatch(executeLogoff());

    expect(seenAtPost).toEqual([resetHello.type]);
  });

  it("posts nothing but the state nonce to a page relative endpoint", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness({ common: { flow: "oidc", query: { scope: "openid" } } });

    await store.dispatch(executeLogoff());

    expect(postedUrl()).toBe("./identifier/_/logoff");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
    // Logoff needs no flow or query context, unlike hello.
    expect(postedBody()).toEqual({ state: expect.any(String) });
  });

  it("dispatches a successful logoff and resolves with the response", async () => {
    const reply: Omit<StateResponse, "state"> = { success: true };
    replyEchoingState(200, { ...reply });
    const { store, actions } = newHarness({ login: { username: "user1", password: "secret" } });

    const response = await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveLogoff.type]);
    receiveLogoffAction(actions[1]); // the reply's success is read off the resolved value, not the action
    expect(response).toEqual({ success: true, state: postedBody().state });
    // The login reducer forgets the credentials once logoff is received.
    expect(store.getState().login.username).toBe("");
    expect(store.getState().login.password).toBe("");
  });

  it("ends the session even when the logoff reply is unsuccessful", async () => {
    replyEchoingState(200, { success: false });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    // A 200 answered the request, so the flag the reply carries changes nothing.
    expect(actions[1].type).toBe(receiveLogoff.type);
    expect(store.getState().login.username).toBe("");
  });

  it("treats a 204 as an unexpected status, unlike logon and consent", async () => {
    // Logoff has no 204 arm at all, so the empty reply those endpoints use for
    // a negative answer is an error here.
    replyNoContentEchoingState();
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
  });

  it("reports a reply whose state does not echo the request", async () => {
    fetchMock().mockResolvedValue(jsonReply(200, { success: true, state: "not-the-nonce" }));
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type, receiveError.type]);
    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
  });

  it("reports a request which never got a response as a network error", async () => {
    fetchMock().mockRejectedValue(new TypeError("Failed to fetch"));
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(reportedError(actions[1]).message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(store.getState().common.error?.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });

  it("resolves an unsuccessful result on failure rather than nothing", async () => {
    // Welcomescreen and Goodbyescreen both read success off the resolved value,
    // so resolving undefined made a failed sign out throw instead of report.
    fetchMock().mockRejectedValue(new TypeError("Failed to fetch"));
    const { store } = newHarness();

    const response = await store.dispatch(executeLogoff());

    expect(response).toMatchObject({
      success: false,
      errors: { http: { message: ERROR_HTTP_NETWORK_ERROR } },
    });
  });

  it("resolves the same unsuccessful shape on an abort, without an error", async () => {
    // Callers read success off the value either way, but nobody should be told
    // about a request they cancelled themselves.
    fetchMock().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([resetHello.type]);
    expect(response).toMatchObject({ success: false, errors: {} });
    expect(store.getState().common.error).toBeNull();
  });
});
