/*
 * What the hello endpoint is asked. Only the three flows below carry the OIDC
 * request parameters; any other flow is dropped rather than sent on, so the
 * server is never handed a flow it did not offer.
 */
export interface HelloRequest {
  flow?: string;
  prompt?: string;
  scope?: string;
  client_id?: string;
  redirect_uri?: string;
  id_token_hint?: string;
  max_age?: string;
  resource?: string;
}

export function newHelloRequest(flow: string | null | undefined, query: Record<string, string>): HelloRequest {
  const r: HelloRequest = {};

  if (query.prompt) {
    // TODO(longsleep): Validate prompt values?
    r.prompt = query.prompt;
  }

  let selectedFlow: string | null | undefined = flow;
  switch (flow) {
    case "oauth":
    case "consent":
    case "oidc":
      r.scope = query.scope || "";
      r.client_id = query.client_id || "";
      r.redirect_uri = query.redirect_uri || "";
      if (query.id_token_hint) {
        r.id_token_hint = query.id_token_hint;
      }
      if (query.max_age) {
        r.max_age = query.max_age;
      }
      if (query.resource) {
        r.resource = query.resource;
      }
      if (query.claims_scope) {
        // Add additional scopes from claims request if given. The request may
        // carry no scope of its own, so joining must not leave a leading space.
        r.scope = r.scope ? `${r.scope} ${query.claims_scope}` : query.claims_scope;
      }
      break;

    default:
      selectedFlow = null;
  }

  if (selectedFlow) {
    r.flow = selectedFlow;
  }

  return r;
}
