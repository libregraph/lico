import React from 'react';
import { screen } from '@testing-library/react';

import {
  postedBody,
  postedInit,
  postedUrl,
  renderWithProviders,
  replyEchoingState,
  stubFetch
} from './test-utils';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    stubFetch();
    /* The client rejects a response whose state does not echo the request's. */
    replyEchoingState(200, { success: false, flow: '' });
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

    expect(postedUrl()).toBe('./identifier/_/hello');
    expect(postedBody()).toEqual(
      expect.objectContaining({ state: expect.any(String) })
    );
    expect(postedInit().headers).toEqual({
      'Content-Type': 'application/json',
      'Kopano-Konnect-XSRF': '1'
    });
  });
});
