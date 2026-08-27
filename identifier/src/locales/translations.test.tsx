import React from 'react';
import { screen } from '@testing-library/react';

import Consent from '../containers/Login/Consent';
import {
  ClientDetails,
  HelloResponse,
  ScopesMeta,
  fetchMock,
  getTestI18n,
  jsonReply,
  newTestHistory,
  renderWithProviders,
  stubFetch
} from '../test-utils';

import de from './de/translation.json';
import es from './es/translation.json';
import fr from './fr/translation.json';
import itIT from './it/translation.json';
import nl from './nl/translation.json';
import zhCN from './zh-CN/translation.json';

/*
 * These files are generated from i18n/*.po by `make -C identifier/i18n json`,
 * the same way src/locales/locales.json is, which the locale tests already rely
 * on. The consent screen is the strictest consumer of them: it builds two
 * sentences with <Trans>, wrapping the client application's name in nested
 * elements, and the translations carry that nesting as <0><0><0></0></0></0>
 * and <1><0></0></1>. A translator who drops or reorders one of those tags
 * leaves i18next unable to map the child, and the application's name silently
 * disappears from the sentence asking the user to grant it access. The word
 * order around the tags legitimately differs per language, so this asserts the
 * rendered result rather than the shape of the string.
 */
const locales: Record<string, Record<string, unknown>> = {
  de,
  es,
  fr,
  it: itIT,
  nl,
  'zh-CN': zhCN
};

const client: ClientDetails = {
  id: 'playground.js',
  display_name: 'OIDC Playground',
  redirect_uri: 'https://example.test/',
  trusted: false
};

const scopesMeta: ScopesMeta = {
  mapping: { openid: 'basic', profile: 'basic', email: 'basic' },
  definitions: { basic: { priority: 20, id: 'scope_alias_basic' } }
};

const hello: HelloResponse = {
  state: 'echo-nonce',
  flow: 'oidc',
  success: true,
  username: 'user1@example.test',
  displayName: 'User One',
  next: 'consent',
  scopes: { openid: true, profile: true, email: true },
  client,
  meta: { scopes: scopesMeta }
};

const query = {
  client_id: 'playground.js',
  redirect_uri: 'https://example.test/',
  state: 'ref-1',
  nonce: 'nonce-1',
  scope: 'openid profile email'
};

beforeEach(() => {
  stubFetch();
  // These tests never submit, so the stub only guarantees no request escapes.
  fetchMock().mockResolvedValue(jsonReply(200, { success: true }));
});

for (const lng of Object.keys(locales)) {
  it(`renders the client name inside the consent sentences in ${lng}`, async () => {
    const i18n = getTestI18n();
    i18n.addResourceBundle(lng, 'translation', locales[lng], true, true);
    await i18n.changeLanguage(lng);

    const history = newTestHistory('/consent');
    const { container } = renderWithProviders(<Consent history={history} />, {
      history,
      preloaded: {
        common: {
          hello: {
            state: hello.success,
            username: hello.username,
            displayName: hello.displayName,
            details: hello
          },
          query
        }
      }
    });

    const text = container.textContent ?? '';

    // No unmapped <Trans> index and no unresolved interpolation may reach the DOM.
    expect(text).not.toMatch(/<\d+>/);
    expect(text).not.toMatch(/\{\{/);

    // The client name has to sit inside the wrapping elements of both sentences.
    const wrapped = [...container.querySelectorAll('em')].map((e) => e.textContent);
    expect(wrapped.filter((n) => n === 'OIDC Playground').length).toBeGreaterThanOrEqual(2);

    // Allow and Cancel are present, and the headline interpolated the user.
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    expect(text).toContain('User One');
  });
}
