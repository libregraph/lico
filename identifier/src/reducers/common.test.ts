import commonReducer from './common';
import { receiveError, receiveHello, resetHello } from '../actions/common';
import { Branding, HelloResponse } from '../test-utils';

const initial = () => commonReducer(undefined, { type: '@@INIT' });

describe('commonReducer', () => {
  it('starts with no session and no branding', () => {
    const state = initial();

    expect(state.hello).toBeNull();
    expect(state.branding).toBeNull();
    expect(state.error).toBeNull();
  });

  it('falls back to the default path prefix when the placeholder was not substituted', () => {
    // The server replaces __PATH_PREFIX__ in index.html. In a test nothing does,
    // so the reducer must use its own default rather than the literal.
    expect(initial().pathPrefix).toBe('/signin/v1');
  });

  it('stores a received error', () => {
    const error = new Error('boom');

    const state = commonReducer(initial(), receiveError(error));

    expect(state.error).toBe(error);
  });

  it('records a successful hello as a session', () => {
    const hello: HelloResponse = {
      state: 'ignored',
      flow: 'oidc',
      success: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      next: 'consent'
    };

    const state = commonReducer(initial(), receiveHello(hello));

    // `state` on the stored hello is the boolean signed-in flag derived from
    // success, not the echo nonce of the same name on the wire.
    expect(state.hello).toEqual({
      state: true,
      username: 'user1@example.com',
      displayName: 'Lala 123 abc',
      details: hello
    });
  });

  it('records an unsuccessful hello with a false session flag', () => {
    const hello: HelloResponse = { state: 'x', flow: '', success: false };

    const state = commonReducer(initial(), receiveHello(hello));

    expect(state.hello).toEqual({
      state: false,
      username: undefined,
      displayName: undefined,
      details: hello
    });
  });

  it('takes branding from a hello which carries it', () => {
    const branding: Branding = {
      bannerLogo: 'data:image/svg+xml;base64,AAAA',
      usernameHintText: 'Email'
    };
    const hello: HelloResponse = { state: 'x', flow: '', success: false, branding };

    const state = commonReducer(initial(), receiveHello(hello));

    expect(state.branding).toBe(branding);
  });

  it('keeps existing branding when a later hello omits it', () => {
    const branding: Branding = { usernameHintText: 'Email' };
    const withBranding = commonReducer(
      initial(),
      receiveHello({ state: 'x', flow: '', success: false, branding })
    );

    const after = commonReducer(
      withBranding,
      receiveHello({ state: 'y', flow: '', success: true, username: 'u' })
    );

    expect(after.branding).toBe(branding);
  });

  it('clears the session and branding on reset', () => {
    const seeded = commonReducer(
      initial(),
      receiveHello({
        state: 'x',
        flow: '',
        success: true,
        username: 'u',
        branding: { usernameHintText: 'Email' }
      })
    );

    const state = commonReducer(seeded, resetHello());

    expect(state.hello).toBeNull();
    expect(state.branding).toBeNull();
  });

  it('returns the same state object for an unrelated action', () => {
    const before = initial();

    expect(commonReducer(before, { type: 'SOMETHING_ELSE' })).toBe(before);
  });
});
