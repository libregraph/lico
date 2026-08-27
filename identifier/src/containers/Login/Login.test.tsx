import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import type { Mock } from 'vitest';
import type { MemoryHistory } from 'history';

import Login from './Login';
import { REQUEST_LOGON } from '../../actions/types';
import { Branding, newTestHistory, renderWithProviders } from '../../test-utils';

// No request may escape the test. The mock echoes the client generated state
// nonce, because the action rejects a response whose state differs.
vi.mock('axios', () => ({
  default: { post: vi.fn() }
}));

interface LogonRequestBody {
  params: string[];
  hello: Record<string, string>;
  state: string;
}

const post = axios.post as unknown as Mock;

const logonBodies = (): LogonRequestBody[] =>
  post.mock.calls
    .filter((call: unknown[]) => call[0] === './identifier/_/logon')
    .map((call: unknown[]) => call[1] as LogonRequestBody);

/*
 * Material-UI v4 only wires a label to its input when the TextField is given an
 * id, and these fields have none, so getByLabelText cannot find them. The label
 * is a sibling of the input inside the form control, so look it up from there.
 * This helper is local on purpose; it encodes a quirk of the current markup.
 */
const labelOf = (text: string): HTMLLabelElement =>
  screen.getByText(text, { selector: 'label' }) as HTMLLabelElement;

const fieldOf = (label: string): HTMLInputElement => {
  const input = labelOf(label).parentElement?.querySelector('input');
  if (!input) {
    throw new Error(`no input belongs to the label "${label}"`);
  }
  return input;
};

/*
 * The container is still JavaScript, so the type react-redux's connect() infers
 * for it has no JSX signature TypeScript accepts. Restate the props the router
 * injects in production instead.
 */
const Subject = Login as unknown as React.ComponentType<{ history: MemoryHistory }>;

const renderLogin = (branding?: Branding, loading = '') => {
  // Login is rendered by a Route in the application, so it reads history from
  // its props. Rendered directly it has to be handed one.
  const history = newTestHistory('/identifier');

  return renderWithProviders(<Subject history={history} />, {
    history,
    preloaded: {
      common: { hello: null, branding: branding ?? null, query: {} },
      login: { loading }
    }
  });
};

beforeEach(() => {
  post.mockReset();
  post.mockImplementation((url: string, data: LogonRequestBody) =>
    Promise.resolve({
      status: 200,
      headers: {},
      data: { success: true, state: data.state, hello: null }
    })
  );
});

describe('Login', () => {
  it('offers a username field, a password field and a submit button', () => {
    renderLogin();

    expect(fieldOf('Username')).toBeInTheDocument();
    expect(fieldOf('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('labels the username field "Email" when branding asks for an email hint', () => {
    renderLogin({ usernameHintText: 'Email' });

    expect(labelOf('Email')).toBeInTheDocument();
    expect(screen.queryByText('Username', { selector: 'label' })).not.toBeInTheDocument();
  });

  it('labels the username field "Username" when branding asks for a username hint', () => {
    renderLogin({ usernameHintText: 'Username' });

    expect(labelOf('Username')).toBeInTheDocument();
  });

  it('labels the username field "Username" when branding says nothing', () => {
    renderLogin();

    expect(labelOf('Username')).toBeInTheDocument();
  });

  it('uses an unrecognised username hint verbatim as the field label', () => {
    // Any hint which is not one of the three known ones is shown as given, so a
    // deployment can label the field with its own wording.
    renderLogin({ usernameHintText: 'Company account' });

    expect(labelOf('Company account')).toBeInTheDocument();
  });

  it('shows the branding sign-in page text when one is configured', () => {
    renderLogin({ signinPageText: 'Use your work account.' });

    expect(screen.getByText('Use your work account.')).toBeInTheDocument();
  });

  it('submits the logon when Enter is pressed in the password field (regression: the fields must stay inside a form)', async () => {
    // The abandoned modernization replaced the surrounding <form onSubmit> with
    // a plain <div>, which silently removed keyboard submission.
    renderLogin();

    userEvent.type(fieldOf('Username'), 'user1@example.test');
    userEvent.type(fieldOf('Password'), 'secret123{enter}');

    await waitFor(() => expect(logonBodies()).toHaveLength(1));
    expect(logonBodies()[0].params).toEqual(['user1@example.test', 'secret123', '1']);
  });

  it('sends the logon to the relative endpoint with the XSRF header', async () => {
    renderLogin();

    userEvent.type(fieldOf('Username'), 'user1@example.test');
    userEvent.type(fieldOf('Password'), 'secret123{enter}');

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('./identifier/_/logon');
    expect(post.mock.calls[0][2]).toEqual({ headers: { 'Kopano-Konnect-XSRF': '1' } });
  });

  it('submits the logon when the next button is clicked', async () => {
    renderLogin();

    userEvent.type(fieldOf('Username'), 'user1@example.test');
    userEvent.type(fieldOf('Password'), 'secret123');
    userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(logonBodies()).toHaveLength(1));
    expect(logonBodies()[0].params).toEqual(['user1@example.test', 'secret123', '1']);
  });

  it('refuses to submit without a username and says so', async () => {
    renderLogin();

    userEvent.type(fieldOf('Password'), 'secret123');
    userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByText('Enter a valid value.')).toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });

  it('refuses to submit without a password and says so', async () => {
    renderLogin();

    userEvent.type(fieldOf('Username'), 'user1@example.test');
    userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByText('Enter your password.')).toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });

  it('hides the password until the visibility toggle is used', () => {
    renderLogin();

    const password = fieldOf('Password');
    expect(password).toHaveAttribute('type', 'password');

    userEvent.click(screen.getByLabelText('toggle password visibility'));
    expect(password).toHaveAttribute('type', 'text');

    userEvent.click(screen.getByLabelText('toggle password visibility'));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('disables the next button and shows progress while a logon is in flight', () => {
    renderLogin(undefined, REQUEST_LOGON);

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('leaves the next button usable when no logon is in flight', () => {
    renderLogin();

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
