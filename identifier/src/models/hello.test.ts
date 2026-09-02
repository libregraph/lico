import { newHelloRequest } from "./hello";

// The flows which make the request carry the OIDC parameters. Anything else is
// treated as no flow at all.
const oidcFlows = ["oauth", "consent", "oidc"];

const fullQuery: Record<string, string> = {
  scope: "openid profile email",
  client_id: "playground-trusted.js",
  redirect_uri: "http://localhost:8080/oidc-callback.html",
  id_token_hint: "eyJhbGciOiJQUzI1NiJ9.e30.sig",
  max_age: "300",
};

describe("newHelloRequest", () => {
  for (const flow of oidcFlows) {
    describe(`for the ${flow} flow`, () => {
      it("passes the flow and every OIDC parameter of the query through", () => {
        expect(newHelloRequest(flow, fullQuery)).toEqual({
          flow,
          scope: "openid profile email",
          client_id: "playground-trusted.js",
          redirect_uri: "http://localhost:8080/oidc-callback.html",
          id_token_hint: "eyJhbGciOiJQUzI1NiJ9.e30.sig",
          max_age: "300",
        });
      });

      it("sends the required parameters as empty strings when the query has none", () => {
        // The server distinguishes an absent member from an empty one, so the
        // three required parameters are always emitted.
        expect(newHelloRequest(flow, {})).toEqual({
          flow,
          scope: "",
          client_id: "",
          redirect_uri: "",
        });
      });

      it("omits the optional parameters the query does not carry", () => {
        const request = newHelloRequest(flow, { scope: "openid" });

        expect(request).not.toHaveProperty("id_token_hint");
        expect(request).not.toHaveProperty("max_age");
        expect(request).not.toHaveProperty("prompt");
      });

      it("sends an id token hint on its own", () => {
        expect(newHelloRequest(flow, { id_token_hint: "hint" })).toEqual({
          flow,
          scope: "",
          client_id: "",
          redirect_uri: "",
          id_token_hint: "hint",
        });
      });

      it("sends a max age on its own", () => {
        expect(newHelloRequest(flow, { max_age: "0" })).toEqual({
          flow,
          scope: "",
          client_id: "",
          redirect_uri: "",
          max_age: "0",
        });
      });

      it("appends the scopes requested through claims to the scope", () => {
        expect(newHelloRequest(flow, { scope: "openid profile", claims_scope: "email" })).toEqual({
          flow,
          scope: "openid profile email",
          client_id: "",
          redirect_uri: "",
        });
      });

      it("uses the claims scope alone when the query carries no scope", () => {
        expect(newHelloRequest(flow, { claims_scope: "email" })).toEqual({
          flow,
          scope: "email",
          client_id: "",
          redirect_uri: "",
        });
      });

      it("does not report the claims scope as a member of its own", () => {
        const request = newHelloRequest(flow, { scope: "openid", claims_scope: "email" });

        expect(request).not.toHaveProperty("claims_scope");
      });

      it("copies the prompt of the query", () => {
        expect(newHelloRequest(flow, { prompt: "none" })).toEqual({
          flow,
          prompt: "none",
          scope: "",
          client_id: "",
          redirect_uri: "",
        });
      });
    });
  }

  it("emits nothing at all for an empty flow", () => {
    expect(newHelloRequest("", fullQuery)).toEqual({});
  });

  it("emits nothing at all for an unknown flow", () => {
    expect(newHelloRequest("saml", fullQuery)).toEqual({});
  });

  it("emits nothing at all when no flow was determined", () => {
    // The common reducer stores an empty string when the page was opened
    // without a flow, so this pins tolerance of an absent one rather than the
    // reducer's own output: either way hello is asked for the plain sign in
    // state.
    expect(newHelloRequest(undefined, fullQuery)).toEqual({});
  });

  it("names no flow member when the flow is not an OIDC one", () => {
    expect(newHelloRequest("saml", fullQuery)).not.toHaveProperty("flow");
  });

  it("still carries the prompt when the flow is not an OIDC one", () => {
    expect(newHelloRequest("", { prompt: "select_account" })).toEqual({
      prompt: "select_account",
    });
  });

  it("ignores an empty prompt", () => {
    expect(newHelloRequest("", { prompt: "" })).toEqual({});
  });
});
