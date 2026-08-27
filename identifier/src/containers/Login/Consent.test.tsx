import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import type { Mock } from 'vitest';
import type { MemoryHistory } from 'history';

import Consent from './Consent';
import {
  ClientDetails,
  HelloResponse,
  ScopesMeta,
  newTestHistory,
  renderWithProviders
} from '../../test-utils';

// No request may escape the test. The mock echoes the client generated state
// nonce, because the action rejects a response whose state differs.
vi.mock('axios', () => ({
  default: { post: vi.fn() }
}));

interface ConsentRequestBody {
  allow: boolean;
  scope: string;
  client_id: string;
  redirect_uri: string;
  ref: string;
  flow_nonce: string;
  state: string;
}

const post = axios.post as unknown as Mock;

const consentBodies = (): ConsentRequestBody[] =>
  post.mock.calls
    .filter((call: unknown[]) => call[0] === './identifier/_/consent')
    .map((call: unknown[]) => call[1] as ConsentRequestBody);

const client: ClientDetails = {
  id: 'playground.js',
  display_name: 'OIDC Playground',
  redirect_uri: 'https://example.test/',
  trusted: false
};

// Every requested scope maps to the same basic alias, so the list shows one row.
const scopesMeta: ScopesMeta = {
  mapping: { openid: 'basic', profile: 'basic', email: 'basic' },
  definitions: { basic: { priority: 20, id: 'scope_alias_basic' } }
};

const helloResponse = (overrides: Partial<HelloResponse> = {}): HelloResponse => ({
  state: 'echo-nonce',
  flow: 'oidc',
  success: true,
  username: 'user1@example.test',
  displayName: 'User One',
  next: 'consent',
  scopes: { openid: true, profile: true, email: true },
  client,
  meta: { scopes: scopesMeta },
  ...overrides
});

const query = {
  client_id: 'playground.js',
  redirect_uri: 'https://example.test/',
  state: 'ref-1',
  nonce: 'nonce-1',
  scope: 'openid profile email'
};

/*
 * The container is still JavaScript, so the type react-redux's connect() infers
 * for it has no JSX signature TypeScript accepts. Restate the props the router
 * injects in production instead.
 */
const Subject = Consent as unknown as React.ComponentType<{ history: MemoryHistory }>;

const renderConsent = (details: HelloResponse = helloResponse()) => {
  // Consent is rendered by a Route in the application, so it reads history from
  // its props. Rendered directly it has to be handed one.
  const history = newTestHistory('/consent');

  // Shape of the session as the common reducer stores it.
  const hello = {
    state: details.success,
    username: details.username,
    displayName: details.displayName,
    details
  };

  return renderWithProviders(<Subject history={history} />, {
    history,
    preloaded: { common: { hello, query } }
  });
};

beforeEach(() => {
  post.mockReset();
  post.mockImplementation((url: string, data: ConsentRequestBody) =>
    Promise.resolve({ status: 200, headers: {}, data: { success: true, state: data.state } })
  );
});

describe('Consent', () => {
  it('greets the signed-in user and names the account', () => {
    renderConsent();

    expect(screen.getByText('Hi User One')).toBeInTheDocument();
    expect(screen.getByText('user1@example.test')).toBeInTheDocument();
  });

  it('names the client which asks for consent', () => {
    renderConsent();

    // The sentences are assembled by Trans, so the client name sits in a child
    // element and the assertion has to look at the whole line.
    expect(screen.getByText(/wants to/)).toHaveTextContent('OIDC Playground wants to');
    expect(screen.getByText(/to do this\?/)).toHaveTextContent(
      'Allow OIDC Playground to do this?'
    );
  });

  it('falls back to the client id when the client has no display name', () => {
    renderConsent(helloResponse({ client: { ...client, display_name: '' } }));

    expect(screen.getByText(/to do this\?/)).toHaveTextContent('Allow playground.js to do this?');
  });

  it('lists the requested scopes once per scope alias', () => {
    renderConsent();

    expect(screen.getByText('Access your basic account information')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('omits scopes which were not requested', () => {
    renderConsent(
      helloResponse({
        scopes: { openid: true, offline_access: false },
        meta: {
          scopes: {
            mapping: {},
            definitions: { offline_access: { id: 'scope_offline_access' } }
          }
        }
      })
    );

    expect(
      screen.queryByText('Keep the allowed access persistently and forever')
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows where allowing will send the browser', () => {
    renderConsent();

    expect(
      screen.getByTitle('Clicking "Allow" will redirect you to: https://example.test/')
    ).toBeInTheDocument();
  });

  it('grants the requested scopes when allow is clicked', async () => {
    renderConsent();

    userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(consentBodies()).toHaveLength(1));
    const body = consentBodies()[0];
    expect(body.allow).toBe(true);
    expect(body.scope).toBe('openid profile email');
    expect(body.client_id).toBe('playground.js');
    expect(body.redirect_uri).toBe('https://example.test/');
    expect(body.ref).toBe('ref-1');
    expect(body.flow_nonce).toBe('nonce-1');
    expect(typeof body.state).toBe('string');
  });

  it('denies the request when cancel is clicked', async () => {
    renderConsent();

    userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(consentBodies()).toHaveLength(1));
    expect(consentBodies()[0].allow).toBe(false);
    expect(consentBodies()[0].scope).toBe('openid profile email');
  });

  it('sends the consent to the relative endpoint with the XSRF header', async () => {
    renderConsent();

    userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('./identifier/_/consent');
    expect(post.mock.calls[0][2]).toEqual({ headers: { 'Kopano-Konnect-XSRF': '1' } });
  });

  it('grants consent when Enter is pressed on the focused allow button', async () => {
    renderConsent();

    const allow = screen.getByRole('button', { name: 'Allow' });
    allow.focus();
    // skipClick, because user-event otherwise clicks the button to focus it,
    // which would already count as a decision.
    userEvent.type(allow, '{enter}', { skipClick: true });

    await waitFor(() => expect(consentBodies()).toHaveLength(1));
    expect(consentBodies()[0].allow).toBe(true);
  });

  it('keeps the actions inside a submitting form so Enter reaches a handler (regression: the form must stay a form)', async () => {
    // The abandoned modernization replaced this <form onSubmit> with a plain
    // <div>, which drops keyboard submission. Which decision the submit handler
    // sends is deliberately not asserted, see DEFECTS FOUND.
    const { container } = renderConsent();

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form).toContainElement(screen.getByRole('button', { name: 'Allow' }));
    expect(screen.getByRole('button', { name: 'Allow' })).toHaveAttribute('type', 'submit');

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(consentBodies()).toHaveLength(1));
  });

  it('locks both decisions and shows progress while a decision is in flight', async () => {
    renderConsent();
    post.mockReturnValue(new Promise(() => undefined)); // Never settles.

    userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Allow' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('leaves both decisions open and shows no progress before anything is clicked', () => {
    renderConsent();

    expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('reports an unexpected response status to the user', async () => {
    renderConsent();
    post.mockResolvedValue({ status: 500, headers: {}, data: '' });

    userEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Unexpected HTTP response: 500. Please check your connection and try again.'
        )
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled();
  });
});
