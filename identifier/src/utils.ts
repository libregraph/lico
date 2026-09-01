/*
 * Stamps a request with the client generated nonce the endpoints echo back. The
 * object is stamped in place and returned, because callers keep using the
 * reference they passed in and read the nonce back off it afterwards.
 */
export function withClientRequestState<T extends object>(obj: T): T & { state: string } {
  return Object.assign(obj, { state: Math.random().toString(36).substring(7) });
}

/*
 * Keeps the current query string and fragment when moving to another path. The
 * request parameters of the flow live in the query, so a navigation which drops
 * them strands the visitor with nothing left to continue from.
 *
 * The location is named structurally rather than as a router type, so a plain
 * object is enough to call this with.
 */
export function withSearchAndHash(
  path: string,
  location: { search: string; hash: string }
): string {
  return `${path}${location.search}${location.hash}`;
}
