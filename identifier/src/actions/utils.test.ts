import type { Mock } from 'vitest';

import { postJSON, isAbortError } from './utils';
import { ERROR_HTTP_NETWORK_ERROR, ExtendedError } from '../errors';

const fetchMock = (): Mock => fetch as unknown as Mock;

const options = (): RequestInit => fetchMock().mock.calls[0][1] as RequestInit;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postJSON', () => {
  it('posts the body as JSON to the relative path with the XSRF header', async () => {
    fetchMock().mockResolvedValue(new Response('{}', { status: 200 }));

    await postJSON('./identifier/_/hello', { state: 'st' });

    expect(fetchMock().mock.calls[0][0]).toBe('./identifier/_/hello');
    const init = options();
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"state":"st"}');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'Kopano-Konnect-XSRF': '1'
    });
  });

  it('sends the session cookie by asking for same-origin credentials', async () => {
    // The endpoints authenticate through a cookie, so this is load bearing.
    fetchMock().mockResolvedValue(new Response('{}', { status: 200 }));

    await postJSON('./identifier/_/hello', {});

    expect(options().credentials).toBe('same-origin');
  });

  it('returns the status, the headers and the parsed body', async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ success: true, state: 'st' }), {
        status: 200,
        headers: { 'Kopano-Konnect-State': 'header-state' }
      })
    );

    const result = await postJSON('./identifier/_/hello', {});

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ success: true, state: 'st' });
    // Header lookup is case-insensitive by specification, unlike the lowercased
    // plain object axios exposed.
    expect(result.headers.get('kopano-konnect-state')).toBe('header-state');
    expect(result.headers.get('Kopano-Konnect-State')).toBe('header-state');
  });

  it('resolves rather than throwing for an error status', async () => {
    // This is the whole difference from axios: a 4xx or 5xx arrives as a normal
    // result, so every caller has to switch on the status itself.
    fetchMock().mockResolvedValue(new Response('failed', { status: 502 }));

    const result = await postJSON('./identifier/_/hello', {});

    expect(result.status).toBe(502);
  });

  it('hands back a body which is not JSON as text', async () => {
    // Error replies from this API are plain text. Returning the text lets the
    // caller's state check reject it instead of a parser error reaching the user.
    fetchMock().mockResolvedValue(new Response('not json at all', { status: 500 }));

    expect((await postJSON('./identifier/_/hello', {})).data).toBe('not json at all');
  });

  it('never parses a body into null, so a lookup on the result is safe', async () => {
    fetchMock().mockResolvedValue(new Response('null', { status: 200 }));

    const { data } = await postJSON('./identifier/_/hello', {});

    expect(data).toBe('null');
  });

  it('reports an empty body for a reply which carries none', async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));

    const { status, data } = await postJSON('./identifier/_/logon', {});

    expect(status).toBe(204);
    expect(data).toBe('');
  });

  it('turns a request which never produced a response into a network error', async () => {
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'));

    const error: unknown = await postJSON('./identifier/_/hello', {}).catch((e: unknown) => e);

    if (!(error instanceof ExtendedError)) {
      throw new Error(`expected an ExtendedError, got ${String(error)}`);
    }
    expect(error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
    expect(error.values).toBeUndefined();
  });

  it('passes the signal to fetch and rethrows an abort unchanged', async () => {
    // An abort is the caller's own doing, so it must stay distinguishable from
    // a connection failure rather than being reported to the user.
    const controller = new AbortController();
    const aborted = new DOMException('aborted', 'AbortError');
    fetchMock().mockRejectedValue(aborted);

    const error: unknown = await postJSON('./identifier/_/hello', {}, {
      signal: controller.signal
    }).catch((e: unknown) => e);

    expect(error).toBe(aborted);
    expect(options().signal).toBe(controller.signal);
  });
});

describe('isAbortError', () => {
  it('recognises an abort', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAbortError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAbortError(new ExtendedError(ERROR_HTTP_NETWORK_ERROR))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});
