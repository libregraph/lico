import { act, screen } from "@testing-library/react";

import { getTestI18n, renderWithProviders, type ScopesMeta } from "../test-utils";
import ScopesList from "./ScopesList";

/*
 * Shaped like the meta.scopes block a hello response carries. Two OIDC scopes
 * deliberately map onto the same definition, which is what the de-duplication
 * in ScopesList exists for.
 */
const meta: ScopesMeta = {
  mapping: {
    profile: "scope_alias_basic",
    email: "scope_alias_basic",
    openid: "scope_openid",
    offline_access: "scope_offline_access",
    orphan: "scope_without_definition",
  },
  definitions: {
    scope_alias_basic: { id: "scope_alias_basic", priority: 1 },
    scope_openid: { id: "scope_openid", description: "Verify your identity", priority: 2 },
    scope_offline_access: { id: "scope_offline_access", priority: 3 },
  },
};

/*
 * Operator configured scopes, shaped as scopes.yaml delivers them: no id, so
 * their wording comes from the file rather than from the app's own catalog.
 * The server sends every translation it holds, because the language is picked
 * here and can change without another hello.
 */
const translated: ScopesMeta = {
  mapping: {},
  definitions: {
    calendar: {
      priority: 100,
      description: "Access your calendar",
      descriptions: { de: "Auf Ihren Kalender zugreifen", "fr-CA": "Accéder à votre agenda" },
    },
    files: { description: "Access your files" },
    only_translated: { descriptions: { de: "Nur auf Deutsch" } },
    aliased: { id: "scope_alias_basic", descriptions: { "en-GB": "Operator wording" } },
  },
};

describe("ScopesList", () => {
  /*
   * getTestI18n hands out a process wide instance, so a case which changes the
   * language has to put it back or it silently retunes every case after it.
   */
  afterEach(async () => {
    await getTestI18n().changeLanguage("en-GB");
  });

  it("names the basic account alias with its own wording", () => {
    renderWithProviders(<ScopesList scopes={{ profile: true }} meta={meta} />);

    expect(screen.getByText("Access your basic account information")).toBeInTheDocument();
  });

  it("names offline access with its own wording", () => {
    renderWithProviders(<ScopesList scopes={{ offline_access: true }} meta={meta} />);

    expect(screen.getByText("Maintain access to data you have given it access to")).toBeInTheDocument();
  });

  it("uses the definition description when the scope has no special wording", () => {
    renderWithProviders(<ScopesList scopes={{ openid: true }} meta={meta} />);

    expect(screen.getByText("Verify your identity")).toBeInTheDocument();
  });

  it("shows the raw scope name when neither a mapping nor a definition exists", () => {
    renderWithProviders(<ScopesList scopes={{ some_custom_scope: true }} meta={meta} />);

    expect(screen.getByText("Scope: some_custom_scope")).toBeInTheDocument();
  });

  it("shows the raw scope name when the mapping points at a missing definition", () => {
    renderWithProviders(<ScopesList scopes={{ orphan: true }} meta={meta} />);

    // The fallback interpolates the requested scope, not the definition id.
    expect(screen.getByText("Scope: orphan")).toBeInTheDocument();
  });

  it("renders a single row for two scopes which map to the same definition", () => {
    renderWithProviders(<ScopesList scopes={{ profile: true, email: true }} meta={meta} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByText("Access your basic account information")).toHaveLength(1);
  });

  it("skips a scope which was not granted", () => {
    renderWithProviders(<ScopesList scopes={{ openid: true, offline_access: false }} meta={meta} />);

    expect(screen.getByText("Verify your identity")).toBeInTheDocument();
    expect(screen.queryByText("Maintain access to data you have given it access to")).not.toBeInTheDocument();
  });

  it("renders nothing at all when no scope was granted", () => {
    renderWithProviders(<ScopesList scopes={{ openid: false }} meta={meta} />);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("states each scope rather than drawing a control for it", () => {
    renderWithProviders(<ScopesList scopes={{ profile: true, openid: true, offline_access: true }} meta={meta} />);

    // A checked and disabled checkbox claimed these were choices already made
    // and locked. Nothing here is a choice: the grant is every requested scope
    // or none, and this list is never read back.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("states offline access last, whatever order the scopes arrive in", () => {
    // The server marshals the scopes as a JSON object, so their keys arrive
    // sorted rather than in any order this screen chose. How long the grant
    // lasts belongs after the data it outlives.
    renderWithProviders(<ScopesList scopes={{ offline_access: true, openid: true, profile: true }} meta={meta} />);

    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);

    expect(rows).toHaveLength(3);
    expect(rows[2]).toBe("Maintain access to data you have given it access to");
  });

  it("renders the translation for the active language", async () => {
    await act(() => getTestI18n().changeLanguage("de"));

    renderWithProviders(<ScopesList scopes={{ calendar: true }} meta={translated} />);

    expect(screen.getByText("Auf Ihren Kalender zugreifen")).toBeInTheDocument();
  });

  it("serves a region variant to a request for the plain language", async () => {
    // Only fr-CA is configured, and the visitor's language is fr.
    await act(() => getTestI18n().changeLanguage("fr"));

    renderWithProviders(<ScopesList scopes={{ calendar: true }} meta={translated} />);

    expect(screen.getByText("Accéder à votre agenda")).toBeInTheDocument();
  });

  it("falls back to the plain description when no translation fits", async () => {
    await act(() => getTestI18n().changeLanguage("nl"));

    renderWithProviders(<ScopesList scopes={{ calendar: true, files: true }} meta={translated} />);

    expect(screen.getByText("Access your calendar")).toBeInTheDocument();
    expect(screen.getByText("Access your files")).toBeInTheDocument();
  });

  it("shows the raw scope name when the translations miss and there is no description", async () => {
    await act(() => getTestI18n().changeLanguage("nl"));

    renderWithProviders(<ScopesList scopes={{ only_translated: true }} meta={translated} />);

    expect(screen.getByText("Scope: only_translated")).toBeInTheDocument();
  });

  it("follows a language change without another hello", async () => {
    // The consent screen renders from the store and nothing refetches hello
    // when the visitor uses the language picker, so the translations have to
    // arrive whole and be chosen here.
    await act(() => getTestI18n().changeLanguage("de"));

    renderWithProviders(<ScopesList scopes={{ calendar: true }} meta={translated} />);

    await act(() => getTestI18n().changeLanguage("fr"));

    expect(screen.getByText("Accéder à votre agenda")).toBeInTheDocument();
    expect(screen.queryByText("Auf Ihren Kalender zugreifen")).not.toBeInTheDocument();
  });

  it("keeps the app's own wording for a definition which carries an id", () => {
    // An id means the app owns that sentence, so operator translations of it
    // are ignored rather than merged.
    renderWithProviders(<ScopesList scopes={{ aliased: true }} meta={translated} />);

    expect(screen.getByText("Access your basic account information")).toBeInTheDocument();
    expect(screen.queryByText("Operator wording")).not.toBeInTheDocument();
  });
});
