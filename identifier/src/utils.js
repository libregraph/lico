export function withClientRequestState(obj) {
  obj.state = Math.random().toString(36).substring(7);

  return obj;
}

// Keeps the current query string and fragment when moving to another path. The
// request parameters of the flow live in the query, so a navigation which drops
// them strands the visitor with nothing left to continue from.
export function withSearchAndHash(path, location) {
  return `${path}${location.search}${location.hash}`;
}
