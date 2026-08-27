import { withClientRequestState } from './utils';

describe('withClientRequestState', () => {
  it('adds a non empty state nonce', () => {
    const request = withClientRequestState({});

    expect(typeof request.state).toBe('string');
    expect(request.state.length).toBeGreaterThan(0);
  });

  it('stamps the given object in place instead of copying it', () => {
    // Callers rely on this, they pass a request body they built themselves and
    // keep using the same reference afterwards.
    const request: Record<string, unknown> = {};

    expect(withClientRequestState(request)).toBe(request);
  });

  it('keeps the members the caller already put on the request', () => {
    const request = withClientRequestState({
      username: 'user1@example.com',
      password: 'secret',
      mode: '1'
    });

    expect(request.username).toBe('user1@example.com');
    expect(request.password).toBe('secret');
    expect(request.mode).toBe('1');
  });

  it('produces a different nonce for every request', () => {
    // The nonce is echoed back by the server and compared, so a constant value
    // would let a stale response be accepted as the answer to a new request.
    const nonces = new Set<string>();
    for (let i = 0; i < 50; i++) {
      nonces.add(withClientRequestState({}).state);
    }

    expect(nonces.size).toBeGreaterThan(1);
  });

  it('overwrites a state member the caller supplied', () => {
    const request = withClientRequestState({ state: 'stale' });

    expect(request.state).not.toBe('stale');
  });
});
