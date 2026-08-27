import React from 'react';
import { screen } from '@testing-library/react';
import type { Mock } from 'vitest';
import axios from 'axios';

import { renderWithProviders } from './test-utils';
import App from './App';

vi.mock('axios', () => ({
  default: { post: vi.fn() }
}));

// The whole module is replaced by the factory above, so post is a vitest mock.
const post = axios.post as unknown as Mock;

/* The client rejects a response whose state does not echo the request's. */
function echoState(data: unknown): unknown {
  return data && typeof data === 'object' && 'state' in data ? data.state : undefined;
}

describe('App', () => {
  beforeEach(() => {
    post.mockImplementation((url: string, data: unknown) =>
      Promise.resolve({
        status: 200,
        headers: {},
        data: { success: false, flow: '', state: echoState(data) }
      })
    );
  });

  it('takes a visitor who is not signed in to the sign in screen', async () => {
    renderWithProviders(<App />);

    // Main is loaded lazily behind a Suspense boundary, so the spinner shows
    // first. Awaiting the query is what makes this assert the real tree.
    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('asks the server who the visitor is while it starts up', async () => {
    renderWithProviders(<App />);

    await screen.findByText('Sign in');

    expect(post).toHaveBeenCalledWith(
      './identifier/_/hello',
      expect.objectContaining({ state: expect.any(String) }),
      { headers: { 'Kopano-Konnect-XSRF': '1' } }
    );
  });
});
