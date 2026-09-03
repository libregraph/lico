import { createContext, useContext } from "react";

import queryString from "query-string";

/*
 * What the browser was asked to sign in for, taken off the URL it arrived on.
 *
 * None of it is state: it is fixed the moment the document is served and no
 * code path changes it. It lived in a reducer once, computed at module load,
 * which meant a test could never vary it and a reader could not tell it apart
 * from the session, which really does change.
 *
 * The thunks receive it as their extra argument and the form reads it from the
 * context below, both from the single read in index.tsx. The server's names for
 * these are the same: `flow` is one of the values in its flows.go, and the
 * query is what it stashes as RawQuery and turns into a HelloRequest.
 */
export interface SignInRequest {
  /* The OIDC flow this request belongs to, or empty when it names none. */
  flow: string;
  /* The remaining request parameters. `flow` is removed, having its own field. */
  query: Record<string, string>;
}

/*
 * Where the webapp is served from, which is also the router's basename. This is
 * a property of the deployment rather than of the request: the server holds it
 * in its Config, beside StaticFolder, and substitutes it into the document.
 */
export const DEFAULT_PATH_PREFIX = "/signin/v1";

/*
 * Both readers take what they read as a parameter, so a test can hand in a URL
 * or an element instead of having to arrange the real ones before this module
 * is first imported.
 */
export function readSignInRequest(search: string): SignInRequest {
  /*
   * query-string hands back an array when a parameter repeats. Every reader
   * here treats these as single values, and the OIDC request parameters are
   * single valued, so the map is named as strings rather than teaching each
   * reader to unwrap one.
   */
  const query = queryString.parse(search) as Record<string, string>;
  const flow = query.flow || "";
  delete query.flow;

  return { flow, query };
}

export function readPathPrefix(root: Element | null): string {
  const prefix = root?.getAttribute("data-path-prefix");

  // Not substituted means nobody replaced the placeholder, so this is a dev
  // server or a stray build rather than a deployment. Use the sane default.
  return !prefix || prefix === "__PATH_PREFIX__" ? DEFAULT_PATH_PREFIX : prefix;
}

const SignInRequestContext = createContext<SignInRequest | null>(null);

export const SignInRequestProvider = SignInRequestContext.Provider;

export function useSignInRequest(): SignInRequest {
  const request = useContext(SignInRequestContext);
  if (!request) {
    throw new Error("no sign-in request in context: the tree is not wrapped in a SignInRequestProvider");
  }
  return request;
}

const PathPrefixContext = createContext<string | null>(null);

export const PathPrefixProvider = PathPrefixContext.Provider;

export function usePathPrefix(): string {
  const pathPrefix = useContext(PathPrefixContext);
  if (pathPrefix === null) {
    throw new Error("no path prefix in context: the tree is not wrapped in a PathPrefixProvider");
  }
  return pathPrefix;
}
