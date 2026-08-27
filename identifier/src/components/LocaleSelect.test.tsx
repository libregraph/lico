import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next, { i18n as I18nInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import allLocales from '../locales';
import { setTestLanguages } from '../test-utils';
import LocaleSelect from './LocaleSelect';

/*
 * These tests build their own i18next instance rather than using the shared one
 * for two reasons. LocaleSelect mutates the instance's options while resolving a
 * locale, so a shared instance would leak between tests. And the best match
 * lookup is decided by i18next's LanguageUtils, which captures supportedLngs at
 * construction: with the shared instance's `supportedLngs: false` every browser
 * code matches verbatim and the lookup degenerates. Mirroring src/i18n.ts, which
 * passes the shipped locale list, is what reproduces production behaviour.
 */
function newProductionLikeI18n(lng: string): I18nInstance {
  const instance = i18next.createInstance();
  instance
    .use(new LanguageDetector())
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng: 'en-GB',
      supportedLngs: allLocales.map(locale => locale.locale),
      resources: {},
      initImmediate: false,
      interpolation: { escapeValue: false },
      detection: { order: ['navigator'], caches: [] }
    });
  return instance;
}

function renderSelect(instance: I18nInstance, locales?: string[]) {
  return render(
    <I18nextProvider i18n={instance}>
      <LocaleSelect locales={locales} />
    </I18nextProvider>
  );
}

// Filtering keeps the order of src/locales, so 'de' is the first of this pair.
const deAndFr = ['de', 'fr'];

let restoreLanguages: () => void;

describe('LocaleSelect', () => {
  beforeEach(() => {
    restoreLanguages = setTestLanguages(['en-US', 'en']);
  });

  afterEach(() => {
    restoreLanguages();
  });

  it('renders one menu item per enabled locale, labelled with its native name', () => {
    const instance = newProductionLikeI18n('de');

    renderSelect(instance, deAndFr);
    userEvent.click(screen.getByRole('button'));

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Deutsch',
      'Français'
    ]);
  });

  it('drops a requested locale the application does not ship', () => {
    const instance = newProductionLikeI18n('de');

    renderSelect(instance, ['de', 'fr', 'kl']);
    userEvent.click(screen.getByRole('button'));

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('renders nothing when only a single locale is enabled', () => {
    const instance = newProductionLikeI18n('de');

    const { container } = renderSelect(instance, ['de']);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers every shipped locale when no list is given', () => {
    const instance = newProductionLikeI18n('de');

    renderSelect(instance);
    userEvent.click(screen.getByRole('button'));

    expect(screen.getAllByRole('option')).toHaveLength(allLocales.length);
  });

  it('picks the locale which best matches the browser rather than the first one offered', async () => {
    // The browser asks for Swiss French, which is not offered verbatim. 'de' is
    // the first entry of the enabled list, so a "take the first" implementation
    // would land there. Only a real best-match lookup arrives at 'fr'.
    setTestLanguages(['fr-CH', 'fr']);
    const instance = newProductionLikeI18n('en-GB');

    renderSelect(instance, deAndFr);

    await waitFor(() => expect(instance.language).toBe('fr'));
    expect(instance.language).not.toBe('de');
    expect(screen.getByRole('button')).toHaveTextContent('Français');
  });

  it('falls back to the first enabled locale when no browser language matches', async () => {
    setTestLanguages(['ja-JP', 'ja']);
    const instance = newProductionLikeI18n('en-GB');

    renderSelect(instance, deAndFr);

    await waitFor(() => expect(instance.language).toBe('de'));
    expect(screen.getByRole('button')).toHaveTextContent('Deutsch');
  });

  it('keeps the current language when it is among the enabled locales', async () => {
    setTestLanguages(['fr-CH', 'fr']);
    const instance = newProductionLikeI18n('de');

    renderSelect(instance, deAndFr);

    // The browser prefers French, but German is already active and enabled, so
    // an earlier explicit choice must not be overridden.
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Deutsch'));
    expect(instance.language).toBe('de');
  });

  it('switches the language when the user picks another locale', async () => {
    const instance = newProductionLikeI18n('de');

    renderSelect(instance, deAndFr);
    userEvent.click(screen.getByRole('button'));
    userEvent.click(screen.getByRole('option', { name: 'Français' }));

    await waitFor(() => expect(instance.language).toBe('fr'));
    expect(screen.getByRole('button')).toHaveTextContent('Français');
  });
});
