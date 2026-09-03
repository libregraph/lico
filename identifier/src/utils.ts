import { ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, ExtendedError } from "./errors";

/*
 * Stamps a request with the client generated nonce the endpoints echo back. The
 * object is stamped in place and returned, because callers keep using the
 * reference they passed in and read the nonce back off it afterwards.
 */
export function withClientRequestState<T extends object>(obj: T): T & { state: string } {
  return Object.assign(obj, { state: Math.random().toString(36).substring(7) });
}

/*
 * Checks that a reply is the answer to the request that was sent. Every
 * endpoint echoes the nonce back, and a reply carrying a different one belongs
 * to some earlier request, so nothing in it can be trusted about this one.
 *
 * The reply is passed in after its nonce has been resolved, not before: a 204
 * carries the value in a header rather than a body, and only the caller knows
 * which of the two it has to read. That is also why this cannot live inside
 * postJSON, which returns before that is decided.
 */
export function assertEchoedState<T extends { state?: string | null }>(sent: { state: string }, received: T): T {
  if (received.state !== sent.state) {
    throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: received.state });
  }

  return received;
}

/*
 * Keeps the current query string and fragment when moving to another path. The
 * request parameters of the flow live in the query, so a navigation which drops
 * them strands the visitor with nothing left to continue from.
 *
 * The location is named structurally rather than as a router type, so a plain
 * object is enough to call this with.
 */
export function withSearchAndHash(path: string, location: { search: string; hash: string }): string {
  return `${path}${location.search}${location.hash}`;
}
