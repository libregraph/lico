import type { UnknownAction } from "@reduxjs/toolkit";

import {
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_LOGIN_FAILED,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME,
} from "../errors";
import { receiveHello } from "../reducers/common";
import {
  receiveConsent,
  receiveLogon,
  receiveValidateLogon,
  requestConsentAllow,
  requestConsentCancel,
  requestLogon,
} from "../reducers/login";
import { rootReducer } from "../store";
import {
  fetchMock,
  type HelloResponse,
  jsonReply,
  makeStore,
  newTestNavigation,
  type PreloadedState,
  postedBody,
  postedInit,
  postedUrl,
  replyEchoingState,
  replyNoContentEchoingState,
  stubFetch,
} from "../test-utils";
import {
  advanceLogonFlow,
  executeConsent,
  executeLogon,
  executeLogonIfFormValid,
  validateUsernamePassword,
} from "./login";

/*
 * Reading a payload means establishing which action arrived. The creator's own
 * matcher does that and narrows the type with it, so a test which dispatched
 * something else names what actually arrived rather than reading undefined and
 * failing later on an unrelated line.
 */
function receiveHelloAction(action: UnknownAction) {
  if (!receiveHello.match(action)) {
    throw new Error(`expected ${receiveHello.type}, dispatched was ${action.type}`);
  }
  return action;
}

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

beforeEach(() => {
  stubFetch();
});

describe("executeLogon", () => {
  it("announces the request and clears the session before it posts", async () => {
    const { store, actions } = newHarness();
    let seenAtPost: UnknownAction[] = [];
    fetchMock().mockImplementation((_url: string, init: RequestInit) => {
      seenAtPost = [...actions];
      const sent = JSON.parse(String(init.body)) as { state?: string };
      return Promise.resolve(jsonReply(200, { success: true, state: sent.state }));
    });

    await store.dispatch(executeLogon("user1@example.com", "secret"));

    expect(seenAtPost.map((a) => a.type)).toEqual([requestLogon.type, receiveHello.type]);
    // The interim hello carries the username but no session, so a stale signed
    // in state cannot survive into the answer.
    expect(seenAtPost[1]).toEqual({
      type: receiveHello.type,
      payload: { username: "user1@example.com" },
    });
  });

  it("posts to a page relative endpoint with the XSRF header", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon("user1", "secret"));

    expect(postedUrl()).toBe("./identifier/_/logon");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });

  it("posts the username, the password and mode 1 by default", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon("user1@example.com", "secret"));

    expect(postedBody().params).toEqual(["user1@example.com", "secret", "1"]);
  });

  it("posts an empty password with mode 0 for an already signed in user", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon("user1@example.com", "secret", "0"));

    // Mode 0 rides on the session cookie, so the password must not be sent.
    expect(postedBody().params).toEqual(["user1@example.com", "", "0"]);
  });

  it("includes a hello request built from the flow and query", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness({
      common: {
        flow: "oidc",
        query: {
          scope: "openid profile",
          client_id: "playground.js",
          redirect_uri: "https://app.test/callback",
        },
      },
    });

    await store.dispatch(executeLogon("user1", "secret"));

    expect(postedBody().hello).toEqual({
      flow: "oidc",
      scope: "openid profile",
      client_id: "playground.js",
      redirect_uri: "https://app.test/callback",
    });
  });

  it("dispatches the hello from the response and then the logon on a 200", async () => {
    const hello: HelloResponse = {
      state: "server-side",
      flow: "oidc",
      success: true,
      username: "user1@example.com",
      displayName: "Lala 123 abc",
      next: "consent",
    };
    replyEchoingState(200, { success: true, hello });
    const { store, actions } = newHarness({ common: { flow: "oidc" } });

    const response = await store.dispatch(executeLogon("user1@example.com", "secret"));

    expect(actions.map((a) => a.type)).toEqual([
      requestLogon.type,
      receiveHello.type,
      receiveHello.type,
      receiveLogon.type,
    ]);
    expect(actions[2]).toEqual({ type: receiveHello.type, payload: hello });
    expect(actions[3]).toEqual({
      type: receiveLogon.type,
      payload: { success: true, hello, state: postedBody().state },
    });
    expect(response).toEqual({
      success: true,
      hello,
      state: postedBody().state,
    });
    expect(store.getState().common.hello).toEqual({
      state: true,
      username: "user1@example.com",
      displayName: "Lala 123 abc",
      details: hello,
    });
  });

  it("synthesises a hello from the username when the response carries none", async () => {
    replyEchoingState(200, { success: true });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogon("user1@example.com", "secret"));

    expect(actions[2]).toEqual({
      type: receiveHello.type,
      payload: { success: true, username: "user1@example.com" },
    });
  });

  it("treats a 204 as a failed logon and echoes the state from the header", async () => {
    // This is what a wrong password looks like on the wire.
    replyNoContentEchoingState();
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeLogon("user1", "wrong"));

    // Passing the state check proves the nonce was read back out of the
    // Kopano-Konnect-State response header.
    expect(response).toEqual({
      success: false,
      state: postedBody().state,
      errors: { http: { message: ERROR_LOGIN_FAILED } },
    });
    expect(actions.map((a) => a.type)).toEqual([
      requestLogon.type,
      receiveHello.type,
      receiveHello.type,
      receiveLogon.type,
    ]);
    expect(receiveHelloAction(actions[2]).payload.success).toBe(false);
    expect(actions[3]).toEqual({
      type: receiveLogon.type,
      payload: {
        success: false,
        state: postedBody().state,
        errors: { http: { message: ERROR_LOGIN_FAILED } },
      },
    });
    expect(store.getState().login.errors.http.message).toBe(ERROR_LOGIN_FAILED);
    expect(store.getState().login.loading).toBe("");
  });

  it("reports a 204 whose state header does not echo the request", async () => {
    fetchMock().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "Kopano-Konnect-State": "not-the-nonce" },
      }),
    );
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogon("user1", "wrong"));

    expect(result).toMatchObject({
      success: false,
      errors: { http: { message: ERROR_HTTP_UNEXPECTED_RESPONSE_STATE } },
    });
    expect(actions.map((a) => a.type)).toEqual([requestLogon.type, receiveHello.type, receiveValidateLogon.type]);
  });

  it("reports an unexpected response status as a logon error", async () => {
    // fetch resolves for a 500, so the thunk's own status switch is the only
    // thing that turns it into an error.
    fetchMock().mockResolvedValue(new Response("internal server error", { status: 500 }));
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogon("user1", "secret"));

    expect(result).toMatchObject({
      success: false,
      errors: {
        http: {
          message: ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
          values: { status: 500 },
        },
      },
    });
    // A failed logon reports through the form errors, never through the global
    // error which hello uses.
    expect(actions.map((a) => a.type)).toEqual([requestLogon.type, receiveHello.type, receiveValidateLogon.type]);
    expect(store.getState().common.error).toBeNull();
  });

  it("reports a request which never got a response as a network error", async () => {
    fetchMock().mockRejectedValue(new TypeError("Failed to fetch"));
    const { store } = newHarness();

    const result = await store.dispatch(executeLogon("user1", "secret"));

    expect(result).toMatchObject({
      errors: { http: { message: ERROR_HTTP_NETWORK_ERROR } },
    });
    expect(store.getState().login.errors.http.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });

  it("stays silent on an abort and resolves an unsuccessful result", async () => {
    // The caller cancelled the request itself, so there is nothing to report on
    // a form which is going away.
    fetchMock().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeLogon("user1", "secret"));

    expect(actions.map((a) => a.type)).toEqual([requestLogon.type, receiveHello.type]);
    expect(response).toEqual({ success: false, errors: {} });
    expect(store.getState().login.errors).toEqual({});
    expect(store.getState().common.error).toBeNull();
  });
});

describe("executeConsent", () => {
  it("posts the scope and the client details from the query", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness({
      common: {
        flow: "consent",
        query: {
          client_id: "playground.js",
          redirect_uri: "https://app.test/callback",
          state: "caller-state",
          nonce: "caller-nonce",
        },
      },
    });

    await store.dispatch(executeConsent(true, "openid profile email"));

    expect(postedUrl()).toBe("./identifier/_/consent");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
    // ref carries the caller's state while the body's own state is the client
    // generated echo nonce. Two different values with the same name.
    expect(postedBody()).toEqual({
      allow: true,
      scope: "openid profile email",
      client_id: "playground.js",
      redirect_uri: "https://app.test/callback",
      ref: "caller-state",
      flow_nonce: "caller-nonce",
      state: expect.any(String),
    });
    expect(postedBody().state).not.toBe("caller-state");
  });

  it("sends empty strings for query members which are absent", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeConsent());

    expect(postedBody()).toEqual({
      allow: false,
      scope: "",
      client_id: "",
      redirect_uri: "",
      ref: "",
      flow_nonce: "",
      state: expect.any(String),
    });
  });

  it("announces an allow differently from a cancel", async () => {
    replyEchoingState(200, { success: true });
    const allowed = newHarness();
    const cancelled = newHarness();

    await allowed.store.dispatch(executeConsent(true, "openid"));
    await cancelled.store.dispatch(executeConsent(false, "openid"));

    expect(allowed.actions[0]).toEqual({ type: requestConsentAllow.type });
    expect(cancelled.actions[0]).toEqual({ type: requestConsentCancel.type });
  });

  it("dispatches the received consent and resolves with the response on a 200", async () => {
    replyEchoingState(200, { success: true });
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeConsent(true, "openid"));

    expect(actions.map((a) => a.type)).toEqual([requestConsentAllow.type, receiveConsent.type]);
    expect(actions[1]).toEqual({
      type: receiveConsent.type,
      payload: { success: true, state: postedBody().state },
    });
    expect(response).toEqual({ success: true, state: postedBody().state });
  });

  it("treats a 204 as a successful cancel rather than as a failure", async () => {
    replyNoContentEchoingState();
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeConsent(false, ""));

    expect(response).toEqual({ success: true, state: postedBody().state });
    expect(actions[1]).toEqual({
      type: receiveConsent.type,
      payload: { success: true, state: postedBody().state },
    });
  });

  it("reports an unexpected response status through the form errors", async () => {
    fetchMock().mockResolvedValue(new Response("internal server error", { status: 500 }));
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeConsent(true, "openid"));

    expect(result).toMatchObject({
      success: false,
      errors: { http: { message: ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS } },
    });
    expect(actions.map((a) => a.type)).toEqual([requestConsentAllow.type, receiveValidateLogon.type]);
  });

  it("reports a reply whose state does not echo the request", async () => {
    fetchMock().mockResolvedValue(jsonReply(200, { success: true, state: "not-the-nonce" }));
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeConsent(true, "openid"));

    expect(result).toMatchObject({
      errors: { http: { message: ERROR_HTTP_UNEXPECTED_RESPONSE_STATE } },
    });
    expect(actions.map((a) => a.type)).toEqual([requestConsentAllow.type, receiveValidateLogon.type]);
  });

  it("stays silent on an abort and resolves an unsuccessful result", async () => {
    // A request the caller cancelled is not a consent failure to report.
    fetchMock().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeConsent(true, "openid"));

    expect(actions.map((a) => a.type)).toEqual([requestConsentAllow.type]);
    expect(response).toEqual({ success: false, errors: {} });
    expect(store.getState().login.errors).toEqual({});
    expect(store.getState().common.error).toBeNull();
  });
});

describe("validateUsernamePassword", () => {
  it("reports no errors when both are given", () => {
    const { store, actions } = newHarness();

    expect(store.dispatch(validateUsernamePassword("user1", "secret", false))).toEqual({});

    expect(actions).toEqual([{ type: receiveValidateLogon.type, payload: {} }]);
  });

  it("reports a missing username", () => {
    const { store, actions } = newHarness();

    expect(store.dispatch(validateUsernamePassword("", "secret", false))).toEqual({
      username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
    });

    expect(actions.map((a) => a.type)).toEqual([receiveValidateLogon.type]);
    expect(store.getState().login.errors.username.message).toBe(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME);
  });

  it("reports a missing password", () => {
    const { store } = newHarness();

    expect(store.dispatch(validateUsernamePassword("user1", "", false))).toEqual({
      password: { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD },
    });
  });

  it("reports both errors when nothing was entered", () => {
    const { store } = newHarness();

    expect(store.dispatch(validateUsernamePassword("", "", false))).toEqual({
      username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
      password: { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD },
    });
  });

  it("accepts a missing password when the user is already signed in", () => {
    // The signed in form has no password field, so demanding one would make it
    // impossible to submit.
    const { store } = newHarness();

    expect(store.dispatch(validateUsernamePassword("user1", "", true))).toEqual({});
  });

  it("still demands a username when the user is already signed in", () => {
    const { store } = newHarness();

    expect(store.dispatch(validateUsernamePassword("", "", true))).toEqual({
      username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
    });
  });

  it("hands back a plain value rather than a promise", () => {
    // Callers branch on the result directly. A promise here would put an
    // incomplete form back behind a then or a catch clause.
    const { store } = newHarness();

    expect(store.dispatch(validateUsernamePassword("", "", false))).not.toBeInstanceOf(Promise);
  });
});

describe("executeLogonIfFormValid", () => {
  it("logs on with mode 1 when the user is not signed in", async () => {
    replyEchoingState(200, { success: true });
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeLogonIfFormValid("user1@example.com", "secret", false));

    expect(postedBody().params).toEqual(["user1@example.com", "secret", "1"]);
    expect(response).toMatchObject({ success: true });
    expect(actions.map((a) => a.type)).toEqual([
      receiveValidateLogon.type,
      requestLogon.type,
      receiveHello.type,
      receiveHello.type,
      receiveLogon.type,
    ]);
  });

  it("logs on with mode 0 when the user is already signed in", async () => {
    replyEchoingState(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogonIfFormValid("user1@example.com", "", true));

    expect(postedBody().params).toEqual(["user1@example.com", "", "0"]);
  });

  it("returns the validation errors without asking the server", async () => {
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogonIfFormValid("", "", false));

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      errors: {
        username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
        password: { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD },
      },
    });
    expect(actions.map((a) => a.type)).toEqual([receiveValidateLogon.type]);
  });
});

describe("advanceLogonFlow", () => {
  it("does nothing when the logon did not succeed", () => {
    const { store, actions } = newHarness({ common: { flow: "oidc" } });
    const nav = newTestNavigation("/?client_id=playground.js");

    store.dispatch(advanceLogonFlow(false, nav));

    expect(actions).toEqual([]);
    expect(nav.location.pathname).toBe("/");
  });

  it("replaces with the consent route when the flow still needs consent", () => {
    const details: HelloResponse = {
      state: "server-side",
      flow: "oidc",
      success: true,
      next: "consent",
    };
    const { store, actions } = newHarness({
      common: { flow: "oidc", hello: { state: true, username: "user1", details } },
    });
    const nav = newTestNavigation("/?client_id=playground.js#frag");

    store.dispatch(advanceLogonFlow(true, nav));

    // Consent is a step of the same flow, so it replaces rather than pushes and
    // carries the whole query along.
    expect(nav.location.pathname).toBe("/consent");
    expect(nav.location.search).toBe("?client_id=playground.js");
    expect(nav.location.hash).toBe("#frag");
    expect(nav.navigationType).toBe("REPLACE");
    expect(nav.entries).toHaveLength(1);
    expect(actions).toEqual([]);
  });

  it("pushes welcome once consent is done", () => {
    const details: HelloResponse = {
      state: "server-side",
      flow: "oidc",
      success: true,
      next: "consent",
    };
    const { store, actions } = newHarness({
      common: { flow: "oidc", hello: { state: true, username: "user1", details } },
    });
    const nav = newTestNavigation("/?client_id=playground.js");

    store.dispatch(advanceLogonFlow(true, nav, true));

    expect(nav.location.pathname).toBe("/welcome");
    expect(nav.navigationType).toBe("PUSH");
    expect(nav.entries).toHaveLength(2);
    // The reset clears the loading flag the request set.
    expect(actions).toEqual([{ type: receiveValidateLogon.type, payload: {} }]);
  });

  it("ignores the requested flow when the hello answered a different one", () => {
    const details: HelloResponse = {
      state: "server-side",
      flow: "oauth",
      success: true,
      next: "consent",
    };
    const { store } = newHarness({
      common: { flow: "oidc", hello: { state: true, username: "user1", details } },
    });
    const nav = newTestNavigation("/?client_id=playground.js");

    store.dispatch(advanceLogonFlow(true, nav));

    expect(nav.location.pathname).toBe("/welcome");
  });

  it("keeps the query and the fragment when the user arrived by a replace", () => {
    const { store } = newHarness();
    const nav = newTestNavigation("/?client_id=playground.js#frag", "REPLACE");

    store.dispatch(advanceLogonFlow(true, nav));

    // A replace means the identifier rewrote the URL itself, so the parameters
    // it was started with have to survive the hop to welcome.
    expect(nav.location.pathname).toBe("/welcome");
    expect(nav.location.search).toBe("?client_id=playground.js");
    expect(nav.location.hash).toBe("#frag");
  });

  it("drops the query when the user navigated here themselves", () => {
    const { store } = newHarness();
    const nav = newTestNavigation("/?client_id=playground.js#frag");

    store.dispatch(advanceLogonFlow(true, nav));

    expect(nav.location.pathname).toBe("/welcome");
    expect(nav.location.search).toBe("");
    expect(nav.location.hash).toBe("");
  });

  it("refuses a legacy continue which points off origin", () => {
    const { store } = newHarness({
      common: { query: { continue: "https://elsewhere.test/app" } },
    });
    const nav = newTestNavigation("/");

    store.dispatch(advanceLogonFlow(true, nav));

    expect(nav.location.pathname).toBe("/welcome");
  });
});
