import React from 'react';
import { screen } from '@testing-library/react';

import { renderWithProviders, ScopesMeta } from '../test-utils';
import ScopesList from './ScopesList';

/*
 * Shaped like the meta.scopes block a hello response carries. Two OIDC scopes
 * deliberately map onto the same definition, which is what the de-duplication
 * in ScopesList exists for.
 */
const meta: ScopesMeta = {
  mapping: {
    profile: 'scope_alias_basic',
    email: 'scope_alias_basic',
    openid: 'scope_openid',
    offline_access: 'scope_offline_access',
    orphan: 'scope_without_definition'
  },
  definitions: {
    scope_alias_basic: { id: 'scope_alias_basic', priority: 1 },
    scope_openid: { id: 'scope_openid', description: 'Verify your identity', priority: 2 },
    scope_offline_access: { id: 'scope_offline_access', priority: 3 }
  }
};

describe('ScopesList', () => {
  it('names the basic account alias with its own wording', () => {
    renderWithProviders(<ScopesList scopes={{ profile: true }} meta={meta} />);

    expect(screen.getByText('Access your basic account information')).toBeInTheDocument();
  });

  it('names offline access with its own wording', () => {
    renderWithProviders(<ScopesList scopes={{ offline_access: true }} meta={meta} />);

    expect(
      screen.getByText('Keep the allowed access persistently and forever')
    ).toBeInTheDocument();
  });

  it('uses the definition description when the scope has no special wording', () => {
    renderWithProviders(<ScopesList scopes={{ openid: true }} meta={meta} />);

    expect(screen.getByText('Verify your identity')).toBeInTheDocument();
  });

  it('shows the raw scope name when neither a mapping nor a definition exists', () => {
    renderWithProviders(<ScopesList scopes={{ some_custom_scope: true }} meta={meta} />);

    expect(screen.getByText('Scope: some_custom_scope')).toBeInTheDocument();
  });

  it('shows the raw scope name when the mapping points at a missing definition', () => {
    renderWithProviders(<ScopesList scopes={{ orphan: true }} meta={meta} />);

    // The fallback interpolates the requested scope, not the definition id.
    expect(screen.getByText('Scope: orphan')).toBeInTheDocument();
  });

  it('renders a single row for two scopes which map to the same definition', () => {
    renderWithProviders(<ScopesList scopes={{ profile: true, email: true }} meta={meta} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByText('Access your basic account information')).toHaveLength(1);
  });

  it('skips a scope which was not granted', () => {
    renderWithProviders(
      <ScopesList scopes={{ openid: true, offline_access: false }} meta={meta} />
    );

    expect(screen.getByText('Verify your identity')).toBeInTheDocument();
    expect(
      screen.queryByText('Keep the allowed access persistently and forever')
    ).not.toBeInTheDocument();
  });

  it('renders nothing at all when no scope was granted', () => {
    renderWithProviders(<ScopesList scopes={{ openid: false }} meta={meta} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('marks every listed scope as granted and not changeable', () => {
    renderWithProviders(
      <ScopesList scopes={{ profile: true, openid: true, offline_access: true }} meta={meta} />
    );

    const checkboxes = screen.getAllByRole('checkbox');

    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });
  });
});
