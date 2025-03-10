export function withClientRequestState(obj: {[key: string]: string | string[] | {[key: string]: string | object} | boolean | (string | null)[] } ) {
  obj.state = Math.random().toString(36).substring(7);

  return obj;
}
