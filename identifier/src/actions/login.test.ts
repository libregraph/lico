import axios from 'axios';
import { AnyAction, Store } from 'redux';
import type { Mock } from 'vitest';

import rootReducer from '../reducers';
import {
  HelloResponse,
  PreloadedState,
  makeStore,
  newTestHistory
} from '../test-utils';
import {
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_LOGIN_FAILED,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME
} from '../errors';

import * as types from './types';
import {
  advanceLogonFlow,
  executeConsent,
  executeLogon,
  executeLogonIfFormValid,
  validateUsernamePassword
} from './login';

vi.mock('axios');

// The axios default export is a callable object, which vi.mocked cannot narrow
// through on axios 0.22. One cast here keeps the tests below free of casts.
const post = axios.post as unknown as Mock;

/*
 * redux-thunk 2.4 keeps its redux Dispatch augmentation in an opt-in
 * declaration file which this program does not load, so a store's dispatch is
 * typed for plain actions only. These tests dispatch nothing but thunks.
 */
type ThunkStore = Omit<Store, 'dispatch'> & {
  dispatch<R>(thunk: (dispatch: unknown, getState: unknown) => R): R;
};

/*
 * makeStore builds its dispatch chain inside applyMiddleware, so replacing the
 * returned store.dispatch would only see the outermost call and miss whatever a
 * thunk dispatches. A wrapping reducer sees every plain action in order. This
 * helper is local on purpose, since src/test-utils.tsx is shared.
 */
function newHarness(preloaded: PreloadedState = {}) {
  const store = makeStore(preloaded);
  const actions: AnyAction[] = [];

  store.replaceReducer((state, action) => {
    actions.push(action);
    return rootReducer(state, action);
  });
  actions.length = 0; // replaceReducer dispatches an init action of its own.

  return { store: store as unknown as ThunkStore, actions };
}

/*
 * Every request body carries a random state nonce and the client rejects a
 * reply which does not echo it, so the mock has to read it back out of the
 * body it was handed.
 */
function replyWith(status: number, body: Record<string, unknown>): void {
  post.mockImplementation((_url: string, data: { state: string }) =>
    Promise.resolve({ status, data: { ...body, state: data.state }, headers: {} })
  );
}

// A 204 carries no body, so the nonce comes back in a response header.
function replyWithNoContent(): void {
  post.mockImplementation((_url: string, data: { state: string }) =>
    Promise.resolve({
      status: 204,
      data: '',
      headers: { 'kopano-konnect-state': data.state }
    })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('executeLogon', () => {
  it('announces the request and clears the session before it posts', async () => {
    const { store, actions } = newHarness();
    let seenAtPost: AnyAction[] = [];
    post.mockImplementation((_url: string, data: { state: string }) => {
      seenAtPost = [...actions];
      return Promise.resolve({
        status: 200,
        data: { success: true, state: data.state },
        headers: {}
      });
    });

    await store.dispatch(executeLogon('user1@example.com', 'secret'));

    expect(seenAtPost.map((a) => a.type)).toEqual([
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO
    ]);
    // The interim hello carries the username but no session, so a stale signed
    // in state cannot survive into the answer.
    expect(seenAtPost[1]).toEqual({
      type: types.RECEIVE_HELLO,
      state: false,
      username: 'user1@example.com',
      displayName: undefined,
      hello: { username: 'user1@example.com' }
    });
  });

  it('posts to a page relative endpoint with the XSRF header', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon('user1', 'secret'));

    expect(post.mock.calls[0][0]).toBe('./identifier/_/logon');
    expect(post.mock.calls[0][2]).toEqual({
      headers: { 'Kopano-Konnect-XSRF': '1' }
    });
  });

  it('posts the username, the password and mode 1 by default', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon('user1@example.com', 'secret'));

    expect(post.mock.calls[0][1].params).toEqual([
      'user1@example.com',
      'secret',
      '1'
    ]);
  });

  it('posts an empty password with mode 0 for an already signed in user', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeLogon('user1@example.com', 'secret', '0'));

    // Mode 0 rides on the session cookie, so the password must not be sent.
    expect(post.mock.calls[0][1].params).toEqual([
      'user1@example.com',
      '',
      '0'
    ]);
  });

  it('includes a hello request built from the flow and query', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness({
      common: {
        flow: 'oidc',
        query: {
          scope: 'openid profile',
          client_id: 'playground.js',
          redirect_uri: 'https://app.test/callback'
        }
      }
    });

    await store.dispatch(executeLogon('user1', 'secret'));

    expect(post.mock.calls[0][1].hello).toEqual({
      flow: 'oidc',
      scope: 'openid profile',
      client_id: 'playground.js',
      redirect_uri: 'https://app.test/callback'
    });
  });

  it('dispatches the hello from the response and then the logon on a 200', async () => {
    const hello: HelloResponse = {
      state: 'server-side',
      flow: 'oidc',
      success: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      next: 'consent'
    };
    replyWith(200, { success: true, hello });
    const { store, actions } = newHarness({ common: { flow: 'oidc' } });

    const response = await store.dispatch(
      executeLogon('user1@example.com', 'secret')
    );

    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO,
      types.RECEIVE_HELLO,
      types.RECEIVE_LOGON
    ]);
    expect(actions[2]).toEqual({
      type: types.RECEIVE_HELLO,
      state: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      hello
    });
    expect(actions[3]).toEqual({
      type: types.RECEIVE_LOGON,
      success: true,
      errors: undefined
    });
    expect(response).toEqual({
      success: true,
      hello,
      state: post.mock.calls[0][1].state
    });
    expect(store.getState().common.hello).toEqual({
      state: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      details: hello
    });
  });

  it('synthesises a hello from the username when the response carries none', async () => {
    replyWith(200, { success: true });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogon('user1@example.com', 'secret'));

    expect(actions[2]).toEqual({
      type: types.RECEIVE_HELLO,
      state: true,
      username: 'user1@example.com',
      displayName: undefined,
      hello: { success: true, username: 'user1@example.com' }
    });
  });

  it('treats a 204 as a failed logon and echoes the state from the header', async () => {
    // This is what a wrong password looks like on the wire.
    replyWithNoContent();
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeLogon('user1', 'wrong'));

    expect(response.success).toBe(false);
    expect(response.errors.http.message).toBe(ERROR_LOGIN_FAILED);
    // Passing the state check proves the nonce was read from the lowercase
    // response header, which is how axios exposes it.
    expect(response.state).toBe(post.mock.calls[0][1].state);
    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO,
      types.RECEIVE_HELLO,
      types.RECEIVE_LOGON
    ]);
    expect(actions[2].state).toBe(false);
    expect(actions[3]).toEqual({
      type: types.RECEIVE_LOGON,
      success: false,
      errors: response.errors
    });
    expect(store.getState().login.errors.http.message).toBe(ERROR_LOGIN_FAILED);
    expect(store.getState().login.loading).toBe('');
  });

  it('reports a 204 whose state header does not echo the request', async () => {
    post.mockResolvedValue({
      status: 204,
      data: '',
      headers: { 'kopano-konnect-state': 'not-the-nonce' }
    });
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogon('user1', 'wrong'));

    expect(result.success).toBe(false);
    expect(result.errors.http.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO,
      types.RECEIVE_VALIDATE_LOGON
    ]);
  });

  it('reports an unexpected response status as a logon error', async () => {
    post.mockResolvedValue({ status: 500, data: 'internal server error', headers: {} });
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogon('user1', 'secret'));

    expect(result.success).toBe(false);
    expect(result.errors.http.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(result.errors.http.values.status).toBe(500);
    // A failed logon reports through the form errors, never through the global
    // error which hello uses.
    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO,
      types.RECEIVE_VALIDATE_LOGON
    ]);
    expect(store.getState().common.error).toBeNull();
  });

  it('reports a request which never got a response as a network error', async () => {
    post.mockRejectedValue({ request: {}, message: 'Network Error' });
    const { store } = newHarness();

    const result = await store.dispatch(executeLogon('user1', 'secret'));

    expect(result.errors.http.message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(store.getState().login.errors.http.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });
});

describe('executeConsent', () => {
  it('posts the scope and the client details from the query', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness({
      common: {
        flow: 'consent',
        query: {
          client_id: 'playground.js',
          redirect_uri: 'https://app.test/callback',
          state: 'caller-state',
          nonce: 'caller-nonce'
        }
      }
    });

    await store.dispatch(executeConsent(true, 'openid profile email'));

    expect(post.mock.calls[0][0]).toBe('./identifier/_/consent');
    expect(post.mock.calls[0][2]).toEqual({
      headers: { 'Kopano-Konnect-XSRF': '1' }
    });
    // ref carries the caller's state while the body's own state is the client
    // generated echo nonce. Two different values with the same name.
    expect(post.mock.calls[0][1]).toEqual({
      allow: true,
      scope: 'openid profile email',
      client_id: 'playground.js',
      redirect_uri: 'https://app.test/callback',
      ref: 'caller-state',
      flow_nonce: 'caller-nonce',
      state: expect.any(String)
    });
    expect(post.mock.calls[0][1].state).not.toBe('caller-state');
  });

  it('sends empty strings for query members which are absent', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(executeConsent());

    expect(post.mock.calls[0][1]).toEqual({
      allow: false,
      scope: '',
      client_id: '',
      redirect_uri: '',
      ref: '',
      flow_nonce: '',
      state: expect.any(String)
    });
  });

  it('announces an allow differently from a cancel', async () => {
    replyWith(200, { success: true });
    const allowed = newHarness();
    const cancelled = newHarness();

    await allowed.store.dispatch(executeConsent(true, 'openid'));
    await cancelled.store.dispatch(executeConsent(false, 'openid'));

    expect(allowed.actions[0]).toEqual({ type: types.REQUEST_CONSENT_ALLOW });
    expect(cancelled.actions[0]).toEqual({ type: types.REQUEST_CONSENT_CANCEL });
  });

  it('dispatches the received consent and resolves with the response on a 200', async () => {
    replyWith(200, { success: true });
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeConsent(true, 'openid'));

    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_CONSENT_ALLOW,
      types.RECEIVE_CONSENT
    ]);
    expect(actions[1]).toEqual({
      type: types.RECEIVE_CONSENT,
      success: true,
      errors: undefined
    });
    expect(response).toEqual({ success: true, state: post.mock.calls[0][1].state });
  });

  it('treats a 204 as a successful cancel rather than as a failure', async () => {
    replyWithNoContent();
    const { store, actions } = newHarness();

    const response = await store.dispatch(executeConsent(false, ''));

    expect(response.success).toBe(true);
    expect(actions[1]).toEqual({
      type: types.RECEIVE_CONSENT,
      success: true,
      errors: undefined
    });
  });

  it('reports an unexpected response status through the form errors', async () => {
    post.mockResolvedValue({ status: 500, data: 'internal server error', headers: {} });
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeConsent(true, 'openid'));

    expect(result.success).toBe(false);
    expect(result.errors.http.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_CONSENT_ALLOW,
      types.RECEIVE_VALIDATE_LOGON
    ]);
  });

  it('reports a reply whose state does not echo the request', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { success: true, state: 'not-the-nonce' },
      headers: {}
    });
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeConsent(true, 'openid'));

    expect(result.errors.http.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
    expect(actions.map((a) => a.type)).toEqual([
      types.REQUEST_CONSENT_ALLOW,
      types.RECEIVE_VALIDATE_LOGON
    ]);
  });
});

describe('validateUsernamePassword', () => {
  it('resolves with no errors when both are given', async () => {
    const { store, actions } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('user1', 'secret', false))
    ).resolves.toEqual({});

    expect(actions).toEqual([{ type: types.RECEIVE_VALIDATE_LOGON, errors: {} }]);
  });

  it('rejects when the username is missing', async () => {
    const { store, actions } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('', 'secret', false))
    ).rejects.toEqual({ username: new Error(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME) });

    expect(actions.map((a) => a.type)).toEqual([types.RECEIVE_VALIDATE_LOGON]);
    expect(store.getState().login.errors.username.message).toBe(
      ERROR_LOGIN_VALIDATE_MISSINGUSERNAME
    );
  });

  it('rejects when the password is missing', async () => {
    const { store } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('user1', '', false))
    ).rejects.toEqual({ password: new Error(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD) });
  });

  it('rejects with both errors when nothing was entered', async () => {
    const { store } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('', '', false))
    ).rejects.toEqual({
      username: new Error(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME),
      password: new Error(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD)
    });
  });

  it('accepts a missing password when the user is already signed in', async () => {
    // The signed in form has no password field, so demanding one would make it
    // impossible to submit.
    const { store } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('user1', '', true))
    ).resolves.toEqual({});
  });

  it('still demands a username when the user is already signed in', async () => {
    const { store } = newHarness();

    await expect(
      store.dispatch(validateUsernamePassword('', '', true))
    ).rejects.toEqual({ username: new Error(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME) });
  });
});

describe('executeLogonIfFormValid', () => {
  it('logs on with mode 1 when the user is not signed in', async () => {
    replyWith(200, { success: true });
    const { store, actions } = newHarness();

    const response = await store.dispatch(
      executeLogonIfFormValid('user1@example.com', 'secret', false)
    );

    expect(post.mock.calls[0][1].params).toEqual([
      'user1@example.com',
      'secret',
      '1'
    ]);
    expect(response.success).toBe(true);
    expect(actions.map((a) => a.type)).toEqual([
      types.RECEIVE_VALIDATE_LOGON,
      types.REQUEST_LOGON,
      types.RECEIVE_HELLO,
      types.RECEIVE_HELLO,
      types.RECEIVE_LOGON
    ]);
  });

  it('logs on with mode 0 when the user is already signed in', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness();

    await store.dispatch(
      executeLogonIfFormValid('user1@example.com', '', true)
    );

    expect(post.mock.calls[0][1].params).toEqual([
      'user1@example.com',
      '',
      '0'
    ]);
  });

  it('returns the validation errors without asking the server', async () => {
    const { store, actions } = newHarness();

    const result = await store.dispatch(executeLogonIfFormValid('', '', false));

    expect(post).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors.username.message).toBe(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME);
    expect(result.errors.password.message).toBe(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD);
    expect(actions.map((a) => a.type)).toEqual([types.RECEIVE_VALIDATE_LOGON]);
  });
});

describe('advanceLogonFlow', () => {
  it('does nothing when the logon did not succeed', () => {
    const { store, actions } = newHarness({ common: { flow: 'oidc' } });
    const history = newTestHistory('/?client_id=playground.js');

    store.dispatch(advanceLogonFlow(false, history));

    expect(actions).toEqual([]);
    expect(history.location.pathname).toBe('/');
  });

  it('replaces with the consent route when the flow still needs consent', () => {
    const details: HelloResponse = {
      state: 'server-side',
      flow: 'oidc',
      success: true,
      next: 'consent'
    };
    const { store, actions } = newHarness({
      common: { flow: 'oidc', hello: { state: true, username: 'user1', details } }
    });
    const history = newTestHistory('/?client_id=playground.js#frag');

    store.dispatch(advanceLogonFlow(true, history));

    // Consent is a step of the same flow, so it replaces rather than pushes and
    // carries the whole query along.
    expect(history.location.pathname).toBe('/consent');
    expect(history.location.search).toBe('?client_id=playground.js');
    expect(history.location.hash).toBe('#frag');
    expect(history.action).toBe('REPLACE');
    expect(history.entries).toHaveLength(1);
    expect(actions).toEqual([]);
  });

  it('pushes welcome once consent is done', () => {
    const details: HelloResponse = {
      state: 'server-side',
      flow: 'oidc',
      success: true,
      next: 'consent'
    };
    const { store, actions } = newHarness({
      common: { flow: 'oidc', hello: { state: true, username: 'user1', details } }
    });
    const history = newTestHistory('/?client_id=playground.js');

    store.dispatch(advanceLogonFlow(true, history, true));

    expect(history.location.pathname).toBe('/welcome');
    expect(history.action).toBe('PUSH');
    expect(history.entries).toHaveLength(2);
    // The reset clears the loading flag the request set.
    expect(actions).toEqual([{ type: types.RECEIVE_VALIDATE_LOGON, errors: {} }]);
  });

  it('ignores the requested flow when the hello answered a different one', () => {
    const details: HelloResponse = {
      state: 'server-side',
      flow: 'oauth',
      success: true,
      next: 'consent'
    };
    const { store } = newHarness({
      common: { flow: 'oidc', hello: { state: true, username: 'user1', details } }
    });
    const history = newTestHistory('/?client_id=playground.js');

    store.dispatch(advanceLogonFlow(true, history));

    expect(history.location.pathname).toBe('/welcome');
  });

  it('keeps the query and the fragment when the user arrived by a replace', () => {
    const { store } = newHarness();
    const history = newTestHistory('/?client_id=playground.js#frag', 'REPLACE');

    store.dispatch(advanceLogonFlow(true, history));

    // A replace means the identifier rewrote the URL itself, so the parameters
    // it was started with have to survive the hop to welcome.
    expect(history.location.pathname).toBe('/welcome');
    expect(history.location.search).toBe('?client_id=playground.js');
    expect(history.location.hash).toBe('#frag');
  });

  it('drops the query when the user navigated here themselves', () => {
    const { store } = newHarness();
    const history = newTestHistory('/?client_id=playground.js#frag');

    store.dispatch(advanceLogonFlow(true, history));

    expect(history.location.pathname).toBe('/welcome');
    expect(history.location.search).toBe('');
    expect(history.location.hash).toBe('');
  });

  it('refuses a legacy continue which points off origin', () => {
    const { store } = newHarness({
      common: { query: { continue: 'https://elsewhere.test/app' } }
    });
    const history = newTestHistory('/');

    store.dispatch(advanceLogonFlow(true, history));

    expect(history.location.pathname).toBe('/welcome');
  });
});
