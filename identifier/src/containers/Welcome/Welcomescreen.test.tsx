import React, { ComponentType } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { MemoryHistory } from 'history';

import Welcomescreen from './Welcomescreen';
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

// @types/react-redux resolves a second, older copy of @types/react through
// @types/hoist-non-react-statics, so TypeScript rejects the connected component
// as a JSX element. The cast also states the props the router injects.
const Subject = Welcomescreen as unknown as ComponentType<{ history: MemoryHistory }>;

const helloResponse: HelloResponse = {
  state: 'nonce-from-the-server',
  flow: '',
  success: true,
  username: 'user1@example.com',
  displayName: 'Lala 123 abc'
};

/* The shape the common reducer stores, not the wire shape. */
const session = {
  state: true,
  username: helloResponse.username,
  displayName: helloResponse.displayName,
  details: helloResponse
};

/*
 * Welcomescreen builds its children eagerly, so it throws if it re-renders
 * after hello was cleared, which signing out does. In production the connected
 * App stops rendering it in the same commit because PrivateRoute needs a hello.
 * This mirrors only that unmount, so the sign out flow is observable here.
 */
function GatedWelcome({ history }: { history: MemoryHistory }) {
  const hello = useSelector((state: { common: { hello: unknown } }) => state.common.hello);

  return hello ? <Subject history={history} /> : null;
}

function renderWelcome(history = newTestHistory('/welcome', 'POP')) {
  return renderWithProviders(<GatedWelcome history={history} />, {
    history,
    preloaded: { common: { hello: session } }
  });
}

/* Answers a request by echoing back the nonce it carried, as the server does. */
function replyWith(payload: Record<string, unknown>): void {
  post.mockImplementation((_url, body) =>
    Promise.resolve({ status: 200, data: { ...payload, state: body.state }, headers: {} })
  );
}

describe('Welcomescreen', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('greets the signed in user and confirms the session', () => {
    renderWelcome();

    expect(screen.getByText('Welcome Lala 123 abc')).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('You are signed in - awesome!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('does not talk to the server on mount', () => {
    // Unlike Goodbyescreen this screen trusts the hello it was routed with.
    renderWelcome();

    expect(post).not.toHaveBeenCalled();
  });

  it('does not redirect when arriving by client side navigation', () => {
    const history = newTestHistory('/welcome?flow=oidc#frag', 'PUSH');

    renderWelcome(history);

    expect(history.location.pathname).toBe('/welcome');
    expect(history.length).toBe(1);
  });

  it('does not redirect when arriving by a fresh page load', () => {
    // This screen has no mount time guard of its own, unlike the login
    // containers. Access is gated by the PrivateRoute which renders it.
    const history = newTestHistory('/welcome?flow=oidc#frag', 'POP');

    renderWelcome(history);

    expect(history.location.pathname).toBe('/welcome');
    expect(history.length).toBe(1);
  });

  it('posts to the logoff endpoint with the XSRF header when signing out', async () => {
    replyWith({ success: true });
    renderWelcome();

    userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('./identifier/_/logoff');
    expect(typeof body.state).toBe('string');
    expect(config.headers['Kopano-Konnect-XSRF']).toBe('1');
  });

  it('sends the user back to the identifier page after a successful sign out', async () => {
    replyWith({ success: true });
    const history = newTestHistory('/welcome', 'PUSH');
    renderWelcome(history);

    userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(history.location.pathname).toBe('/identifier'));
  });

  it('stays on the welcome page when the server refuses the sign out', async () => {
    replyWith({ success: false });
    const history = newTestHistory('/welcome', 'PUSH');
    renderWelcome(history);

    userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(history.location.pathname).toBe('/welcome');
  });
});
