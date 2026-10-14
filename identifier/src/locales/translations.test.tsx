import { screen } from "@testing-library/react";

import Consent from "../containers/Login/Consent";
import {
  arriveAt,
  type ClientDetails,
  fetchMock,
  getTestI18n,
  type HelloResponse,
  jsonReply,
  renderWithProviders,
  type ScopesMeta,
  stubFetch,
} from "../test-utils";
import de from "./de/translation.json";
import es from "./es/translation.json";
import fr from "./fr/translation.json";
import itIT from "./it/translation.json";
import nl from "./nl/translation.json";
import zhCN from "./zh-CN/translation.json";

/*
 * These files are generated from i18n/*.po by `make -C identifier/i18n json`,
 * the same way src/locales/locales.json is, which the locale tests already rely
 * on. The consent screen is the strictest consumer of them. It builds the
 * sentence naming the client application with <Trans>, wrapping that name in an
 * element the translations carry as <0></0>: a translator who drops it leaves
 * i18next unable to map the child, and the name of the application being
 * granted access silently disappears from the sentence asking to grant it. The
 * domain the browser will be sent to is interpolated into a tooltip instead, so
 * that one is checked for an unresolved placeholder. The word order around both
 * legitimately differs per language, so this asserts the rendered result rather
 * than the shape of the string.
 */
const locales: Record<string, Record<string, unknown>> = {
  de,
  es,
  fr,
  it: itIT,
  nl,
  "zh-CN": zhCN,
};

const client: ClientDetails = {
  id: "playground.js",
  display_name: "OIDC Playground",
  redirect_uri: "https://example.test/",
  trusted: false,
};

const scopesMeta: ScopesMeta = {
  mapping: { openid: "basic", profile: "basic", email: "basic" },
  definitions: { basic: { priority: 20, id: "scope_alias_basic" } },
};

const hello: HelloResponse = {
  state: "echo-nonce",
  flow: "oidc",
  success: true,
  username: "user1@example.test",
  displayName: "User One",
  next: "consent",
  scopes: { openid: true, profile: true, email: true },
  client,
  meta: { scopes: scopesMeta },
};

const query = {
  client_id: "playground.js",
  redirect_uri: "https://example.test/",
  state: "ref-1",
  nonce: "nonce-1",
  scope: "openid profile email",
};

beforeEach(() => {
  stubFetch();
  // These tests never submit, so the stub only guarantees no request escapes.
  fetchMock().mockResolvedValue(jsonReply(200, { success: true }));
});

for (const lng of Object.keys(locales)) {
  it(`renders the client name inside the consent sentences in ${lng}`, async () => {
    const i18n = getTestI18n();
    i18n.addResourceBundle(lng, "translation", locales[lng], true, true);
    await i18n.changeLanguage(lng);

    const { container } = renderWithProviders(<Consent />, {
      ...arriveAt("/consent"),
      request: { query },
      preloaded: {
        common: {
          hello: {
            state: hello.success,
            username: hello.username,
            displayName: hello.displayName,
            details: hello,
          },
        },
      },
    });

    const text = container.textContent ?? "";

    // No unmapped <Trans> index and no unresolved interpolation may reach the DOM.
    expect(text).not.toMatch(/<\d+>/);
    expect(text).not.toMatch(/\{\{/);

    // The client name has to survive the mapping. Its wrapper is a span, so
    // this looks for an element whose whole content is the name.
    const wrapped = [...container.querySelectorAll("span")].map((e) => e.textContent);
    expect(wrapped).toContain("OIDC Playground");

    // The domain reaches the visitor through the indicator's tooltip, which
    // textContent cannot see, so the interpolation is checked on the attribute.
    const hover = container.querySelector("[title]")?.getAttribute("title") ?? "";
    expect(hover).toContain("example.test");
    expect(hover).not.toMatch(/\{\{|<\d+>/);

    // Allow and Cancel are present, and the headline interpolated the user.
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
    expect(text).toContain("User One");
  });

  it(`renders the resource and the unverified client notices in ${lng}`, async () => {
    const i18n = getTestI18n();
    i18n.addResourceBundle(lng, "translation", locales[lng], true, true);
    await i18n.changeLanguage(lng);

    const details: HelloResponse = {
      ...hello,
      client: {
        ...client,
        display_name: "app.example.test",
        redirect_uri: "http://localhost:53682/callback",
        unverified: true,
        claimed_name: "Example CLI",
      },
      resource: { id: "https://mcp.example.test/mcp", name: "Example MCP server" },
    };
    const { container } = renderWithProviders(<Consent />, {
      ...arriveAt("/consent"),
      request: { query },
      preloaded: {
        common: {
          hello: {
            state: details.success,
            username: details.username,
            displayName: details.displayName,
            details,
          },
        },
      },
    });

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/<\d+>/);
    expect(text).not.toMatch(/\{\{/);

    // Both names are wrapped by the sentence, so both have to survive it.
    const wrapped = [...container.querySelectorAll("span")].map((e) => e.textContent);
    expect(wrapped).toContain("app.example.test");
    expect(wrapped).toContain("Example MCP server");

    // Interpolated rather than wrapped, so only their presence can be checked.
    expect(text).toContain("Example CLI");
    expect(text).toContain("localhost:53682");
  });
}
