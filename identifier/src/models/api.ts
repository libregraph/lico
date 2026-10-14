/*
 * Shapes of the identifier API responses, per docs/libregraph-connect-api-v1.yaml.
 * Every endpoint is a POST which echoes back the client generated state nonce,
 * and the actions reject a reply whose nonce differs, so state is never optional.
 */

import type { TranslatableError } from "../errors";

export interface Branding {
  bannerLogo?: string;
  bannerLogoHeight?: string;
  signinPageText?: string;
  usernameHintText?: string;
  signinPageLogoURI?: string;
  locales?: string[];
}

export interface ClientDetails {
  id: string;
  display_name: string;
  redirect_uri: string;
  trusted: boolean;
  // Nobody vouches for this client: it registered itself, or its id is the URL
  // of a metadata document and display_name is the host of that URL.
  unverified?: boolean;
  // The name such a document gives, self-asserted.
  claimed_name?: string;
}

// The protected resource a consent is for, named by the server's registration.
export interface ResourceDetails {
  id: string;
  name?: string;
}

export interface ScopeDefinition {
  priority?: number;
  description?: string;
  // Translations of description, keyed by locale tag. The server sends every
  // one it holds for the requested scopes, because the language is picked in
  // the browser and can change without another hello.
  descriptions?: Record<string, string>;
  id?: string;
}

export interface ScopesMeta {
  mapping: Record<string, string>;
  definitions: Record<string, ScopeDefinition>;
}

export interface HelloResponse {
  state: string;
  flow: string;
  success: boolean;
  username?: string;
  displayName?: string;
  next?: string;
  continue_uri?: string;
  scopes?: Record<string, boolean>;
  client?: ClientDetails;
  resource?: ResourceDetails;
  meta?: { scopes: ScopesMeta };
  branding?: Branding;
}

export interface LogonResponse {
  success: boolean;
  state: string;
  hello: HelloResponse | null;
}

export interface StateResponse {
  success: boolean;
  state: string;
}

/*
 * What the store keeps about the visitor, which is not the hello response
 * itself: the reducer lifts three fields out of the reply and keeps the rest
 * under details. Code asking whether anybody is signed in reads state; code
 * reading a client or the scopes goes through details.
 *
 * details is partial because two kinds of thing land there. A reply from the
 * hello endpoint is complete, but the logon thunk also stores a stub of its own
 * to clear the previous session before its request goes out, and that stub
 * carries a username and nothing else.
 */
export interface Session {
  state: boolean;
  username?: string;
  displayName?: string;
  details: Partial<HelloResponse>;
}

/*
 * The errors carried in the login slice and rendered by ErrorMessage. The keys
 * are field names, plus http for a failure which belongs to the request rather
 * than to a field. They are plain objects rather than Error instances, because
 * everything the store keeps has to survive serialisation.
 */
export type FieldErrors = Record<string, TranslatableError>;

/*
 * A logon or consent attempt as the containers see it. Both the server reply
 * and the locally built refusal for an incomplete form arrive in this shape.
 *
 * state is nullable because a 204 reply carries it in a header rather than a
 * body, and an absent header reads as null. The nonce comparison the callers
 * make then fails, which is the intended outcome for a reply that cannot be
 * matched to its request.
 */
export interface AttemptResult {
  success: boolean;
  errors?: FieldErrors;
  state?: string | null;
  hello?: HelloResponse | null;
}
