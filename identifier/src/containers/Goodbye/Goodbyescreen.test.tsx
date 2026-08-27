import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryHistory } from 'history';

import Goodbyescreen from './Goodbyescreen';
import { HelloResponse, newTestHistory, renderWithProviders } from '../../test-utils';

vi.mock('axios', () => ({
  default: { post: vi.fn() }
}));

interface HttpReply {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

interface RequestConfig {
  headers: Record<string, string>;
}

/* Every request body carries the client generated echo nonce. */
type PostBody = { state: string } & Record<string, unknown>;

const post = vi.mocked(
  axios.post as unknown as (
    url: string,
    body: PostBody,
    config: RequestConfig
  ) => Promise<HttpReply>
);

const Subject = Goodbyescreen;

const HELLO_URL = './identifier/_/hello';
const LOGOFF_URL = './identifier/_/logoff';

const signedIn: HelloResponse = {
  state: 'nonce-from-the-server',
  flow: '',
  success: true,
  username: 'user1@example.com',
  displayName: 'Lala 123 abc'
};

const signedOut: HelloResponse = {
  state: 'nonce-from-the-server',
  flow: '',
  success: false
};

/*
 * Routes each endpoint to a handler and echoes back the nonce the request
 * carried, which is what the client checks the response against.
 */
function replyByUrl(handlers: Record<string, () => Record<string, unknown>>): void {
  post.mockImplementation((url, body) => {
    const handler = handlers[url];
    if (!handler) {
      return Promise.reject(new Error(`unexpected request to ${url}`));
    }
    return Promise.resolve({ status: 200, data: { ...handler(), state: body.state }, headers: {} });
  });
}

/*
 * Starts from a live session and lets a logoff end it, so a hello issued after
 * the sign out reports what the server would really report by then.
 */
function signOutSucceeds(): void {
  let live = true;
  replyByUrl({
    [HELLO_URL]: () => (live ? { ...signedIn } : { ...signedOut }),
    [LOGOFF_URL]: () => {
      live = false;
      return { success: true };
    }
  });
}

function renderGoodbye(history: MemoryHistory = newTestHistory('/goodbye', 'POP')) {
  return renderWithProviders(<Subject history={history} />, { history });
}

function urlsPosted(): string[] {
  return post.mock.calls.map((call) => call[0]);
}

describe('Goodbyescreen', () => {
  beforeEach(() => {
    post.mockReset();
    replyByUrl({ [HELLO_URL]: () => ({ ...signedOut }) });
  });

  it('asks the server for the current session on mount', async () => {
    renderGoodbye();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe(HELLO_URL);
    expect(typeof body.state).toBe('string');
    expect(config.headers['Kopano-Konnect-XSRF']).toBe('1');
  });

  it('shows only a progress indicator until the server answers', () => {
    post.mockImplementation(() => new Promise<HttpReply>(() => undefined));

    renderGoodbye();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Goodbye')).not.toBeInTheDocument();
  });

  it('says goodbye once the server reports no session', async () => {
    renderGoodbye();

    expect(await screen.findByText('Goodbye')).toBeInTheDocument();
    expect(screen.getByText('you have been signed out from your account')).toBeInTheDocument();
    expect(screen.getByText('You can close this window now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('asks the still signed in user to confirm the sign out', async () => {
    replyByUrl({ [HELLO_URL]: () => ({ ...signedIn }) });

    renderGoodbye();

    expect(await screen.findByText('Hello Lala 123 abc')).toBeInTheDocument();
    expect(screen.getByText('please confirm sign out')).toBeInTheDocument();
    expect(
      screen.getByText('Press the button below, to sign out from your account now.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('trusts the server over a session it was preloaded with', async () => {
    // The mount time hello resets the stored session first, so a stale signed
    // in state cannot keep the confirmation screen on display.
    const history = newTestHistory('/goodbye', 'POP');
    renderWithProviders(<Subject history={history} />, {
      history,
      preloaded: {
        common: {
          hello: {
            state: true,
            username: signedIn.username,
            displayName: signedIn.displayName,
            details: signedIn
          }
        }
      }
    });

    expect(await screen.findByText('Goodbye')).toBeInTheDocument();
    expect(screen.queryByText('Hello Lala 123 abc')).not.toBeInTheDocument();
  });

  it('does not redirect when arriving by client side navigation', async () => {
    const history = newTestHistory('/goodbye?flow=oidc#frag', 'PUSH');

    renderGoodbye(history);

    await screen.findByText('Goodbye');
    expect(history.location.pathname).toBe('/goodbye');
    expect(history.length).toBe(1);
  });

  it('does not redirect when arriving by a fresh page load', async () => {
    // This screen has no mount time guard of its own, unlike the login
    // containers; it only refreshes the session.
    const history = newTestHistory('/goodbye?flow=oidc#frag', 'POP');

    renderGoodbye(history);

    await screen.findByText('Goodbye');
    expect(history.location.pathname).toBe('/goodbye');
    expect(history.length).toBe(1);
  });

  it('posts to the logoff endpoint with the XSRF header when the sign out is confirmed', async () => {
    signOutSucceeds();
    renderGoodbye();

    userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(urlsPosted()).toContain(LOGOFF_URL));
    const [, body, config] = post.mock.calls.filter((call) => call[0] === LOGOFF_URL)[0];
    expect(typeof body.state).toBe('string');
    expect(config.headers['Kopano-Konnect-XSRF']).toBe('1');
  });

  it('re-reads the session and lands on the goodbye page after signing out', async () => {
    signOutSucceeds();
    const history = newTestHistory('/goodbye', 'PUSH');
    renderGoodbye(history);

    userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Goodbye')).toBeInTheDocument();
    expect(urlsPosted().filter((url) => url === HELLO_URL)).toHaveLength(2);
    expect(history.location.pathname).toBe('/goodbye');
    expect(history.length).toBe(2);
  });

  it('recovers the confirmation when the server refuses the sign out', async () => {
    // Signing out clears the stored session before the request is sent. The
    // session has to be read again even when the request is refused, otherwise
    // the confirmation disappears and nothing replaces it.
    replyByUrl({
      [HELLO_URL]: () => ({ ...signedIn }),
      [LOGOFF_URL]: () => ({ success: false })
    });
    const history = newTestHistory('/goodbye', 'PUSH');
    renderGoodbye(history);

    userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(urlsPosted()).toContain(LOGOFF_URL));

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(history.length).toBe(1);
    expect(urlsPosted().filter((url) => url === HELLO_URL)).toHaveLength(2);
  });
});
