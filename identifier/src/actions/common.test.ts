import axios from 'axios';
import { AnyAction, Store } from 'redux';
import type { Mock } from 'vitest';

import rootReducer from '../reducers';
import {
  HelloResponse,
  PreloadedState,
  StateResponse,
  makeStore
} from '../test-utils';
import {
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS
} from '../errors';

import * as types from './types';
import { executeHello, executeLogoff, retryHello } from './common';

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

describe('executeHello', () => {
  it('resets any existing hello before it asks the server', async () => {
    const { store, actions } = newHarness();
    let seenAtPost: string[] = [];
    post.mockImplementation((_url: string, data: { state: string }) => {
      seenAtPost = actions.map((a) => a.type);
      return Promise.resolve({
        status: 200,
        data: { success: false, state: data.state },
        headers: {}
      });
    });

    await store.dispatch(executeHello());

    expect(seenAtPost).toEqual([types.RESET_HELLO]);
  });

  it('posts to a page relative endpoint with the XSRF header', async () => {
    replyWith(200, { success: false });
    const { store } = newHarness();

    await store.dispatch(executeHello());

    // The URL is relative to the page the identifier is served from, which is
    // what lets it work under any path prefix.
    expect(post.mock.calls[0][0]).toBe('./identifier/_/hello');
    expect(post.mock.calls[0][2]).toEqual({ headers: { 'Kopano-Konnect-XSRF': '1' } });
  });

  it('builds the posted body from the flow and query held in the store', async () => {
    replyWith(200, { success: false });
    const { store } = newHarness({
      common: {
        flow: 'oidc',
        query: {
          scope: 'openid profile',
          client_id: 'playground.js',
          redirect_uri: 'https://app.test/callback',
          prompt: 'consent'
        }
      }
    });

    await store.dispatch(executeHello());

    expect(post.mock.calls[0][1]).toEqual({
      prompt: 'consent',
      flow: 'oidc',
      scope: 'openid profile',
      client_id: 'playground.js',
      redirect_uri: 'https://app.test/callback',
      state: expect.any(String)
    });
  });

  it('posts only the state nonce when the store holds no recognised flow', async () => {
    replyWith(200, { success: false });
    const { store } = newHarness();

    await store.dispatch(executeHello());

    expect(post.mock.calls[0][1]).toEqual({ state: expect.any(String) });
  });

  it('dispatches the received hello and resolves with the response on a 200', async () => {
    const hello: Omit<HelloResponse, 'state'> = {
      flow: 'oidc',
      success: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      next: 'consent'
    };
    replyWith(200, { ...hello });
    const { store, actions } = newHarness({ common: { flow: 'oidc' } });

    const response = await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.RECEIVE_HELLO
    ]);
    expect(actions[1]).toEqual({
      type: types.RECEIVE_HELLO,
      state: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      hello: response
    });
    expect(response).toEqual({ ...hello, state: post.mock.calls[0][1].state });
  });

  it('records a 200 with success false as not signed in', async () => {
    // The server answers a hello for an anonymous visitor with 200 and
    // success false, never with a 204.
    replyWith(200, { success: false, flow: 'oidc' });
    const { store, actions } = newHarness({ common: { flow: 'oidc' } });

    const response = await store.dispatch(executeHello());

    expect(actions[1]).toEqual({
      type: types.RECEIVE_HELLO,
      state: false,
      username: undefined,
      displayName: undefined,
      hello: response
    });
    expect(store.getState().common.hello.state).toBe(false);
  });

  it('reports a reply whose state does not echo the request', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { success: true, username: 'attacker', state: 'not-the-nonce' },
      headers: {}
    });
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.RECEIVE_ERROR
    ]);
    expect(actions[1].error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
    // A forged reply must never reach the session, and the error has to be
    // readable from the store since that is what the loading screen shows.
    expect(store.getState().common.error.message).toBe(
      ERROR_HTTP_UNEXPECTED_RESPONSE_STATE
    );
    expect(store.getState().common.hello).toBeNull();
  });

  it('reports an unexpected response status', async () => {
    post.mockResolvedValue({ status: 500, data: 'internal server error', headers: {} });
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.RECEIVE_ERROR
    ]);
    expect(actions[1].error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(actions[1].error.values.status).toBe(500);
  });

  it('reports a request which never got a response as a network error', async () => {
    post.mockRejectedValue({ request: {}, message: 'Network Error' });
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.RECEIVE_ERROR
    ]);
    expect(actions[1].error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(store.getState().common.error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });

  it('reports a rejected request which carries a response by its status', async () => {
    post.mockRejectedValue({
      request: {},
      response: { status: 502, data: 'bad gateway' }
    });
    const { store, actions } = newHarness();

    await store.dispatch(executeHello());

    expect(actions[1].error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
    expect(actions[1].error.values.status).toBe(502);
  });
});

describe('retryHello', () => {
  it('clears the standing error before it asks again', async () => {
    replyWith(200, { success: true, username: 'user1@example.com' });
    const { store, actions } = newHarness({
      common: { error: new Error(ERROR_HTTP_NETWORK_ERROR) }
    });

    const response = await store.dispatch(retryHello());

    expect(actions.map((a) => a.type)).toEqual([
      types.RECEIVE_ERROR,
      types.RESET_HELLO,
      types.RECEIVE_HELLO
    ]);
    expect(actions[0].error).toBeNull();
    expect(store.getState().common.error).toBeNull();
    expect(response.username).toBe('user1@example.com');
  });
});

describe('executeLogoff', () => {
  it('resets hello and announces the request before it posts', async () => {
    const { store, actions } = newHarness();
    let seenAtPost: string[] = [];
    post.mockImplementation((_url: string, data: { state: string }) => {
      seenAtPost = actions.map((a) => a.type);
      return Promise.resolve({
        status: 200,
        data: { success: true, state: data.state },
        headers: {}
      });
    });

    await store.dispatch(executeLogoff());

    expect(seenAtPost).toEqual([types.RESET_HELLO, types.REQUEST_LOGOFF]);
  });

  it('posts nothing but the state nonce to a page relative endpoint', async () => {
    replyWith(200, { success: true });
    const { store } = newHarness({ common: { flow: 'oidc', query: { scope: 'openid' } } });

    await store.dispatch(executeLogoff());

    expect(post.mock.calls[0][0]).toBe('./identifier/_/logoff');
    expect(post.mock.calls[0][2]).toEqual({ headers: { 'Kopano-Konnect-XSRF': '1' } });
    // Logoff needs no flow or query context, unlike hello.
    expect(post.mock.calls[0][1]).toEqual({ state: expect.any(String) });
  });

  it('dispatches a successful logoff and resolves with the response', async () => {
    const reply: Omit<StateResponse, 'state'> = { success: true };
    replyWith(200, { ...reply });
    const { store, actions } = newHarness({ login: { username: 'user1', password: 'secret' } });

    const response = await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.REQUEST_LOGOFF,
      types.RECEIVE_LOGOFF
    ]);
    expect(actions[2].state).toBe(true);
    expect(response).toEqual({ success: true, state: post.mock.calls[0][1].state });
    // The login reducer forgets the credentials once logoff is received.
    expect(store.getState().login.username).toBe('');
    expect(store.getState().login.password).toBe('');
  });

  it('dispatches an unsuccessful logoff with a false flag', async () => {
    replyWith(200, { success: false });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions[2]).toEqual({ type: types.RECEIVE_LOGOFF, state: false });
  });

  it('treats a 204 as an unexpected status, unlike hello and logon', async () => {
    // Logoff has no 204 arm at all, so the empty reply the other endpoints use
    // for a negative answer is an error here.
    replyWithNoContent();
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.REQUEST_LOGOFF,
      types.RECEIVE_ERROR
    ]);
    expect(actions[2].error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
  });

  it('reports a reply whose state does not echo the request', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { success: true, state: 'not-the-nonce' },
      headers: {}
    });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions.map((a) => a.type)).toEqual([
      types.RESET_HELLO,
      types.REQUEST_LOGOFF,
      types.RECEIVE_ERROR
    ]);
    expect(actions[2].error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE);
  });

  it('reports a request which never got a response as a network error', async () => {
    post.mockRejectedValue({ request: {}, message: 'Network Error' });
    const { store, actions } = newHarness();

    await store.dispatch(executeLogoff());

    expect(actions[2].error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(store.getState().common.error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });
});
