import {
  ExtendedError,
  ERROR_HTTP_NETWORK_ERROR
} from '../errors';

export interface PostJSONOptions {
  /* Aborts the request when the caller no longer wants the answer. */
  signal?: AbortSignal;
}

export interface PostJSONResult {
  status: number;
  headers: Headers;
  /*
   * The parsed body. It stays unknown because only the caller knows which
   * shape the endpoint it asked for returns, and a status other than success
   * carries plain text rather than an object.
   */
  data: unknown;
}

/*
 * postJSON posts to one of the identifier endpoints and returns the status, the
 * response headers and the parsed body. Paths stay relative because the
 * server's path prefix is deployment configuration, not something the webapp
 * knows.
 *
 * Unlike the axios call this replaces, fetch resolves for every status the
 * server actually sent, so each caller has to switch on the status itself. A
 * rejection from here therefore always means the request produced no response
 * at all: a transport failure, or an abort through the optional signal.
 *
 * The body is parsed the way axios did, leniently. Error replies from this API
 * are plain text rather than JSON, so a parse failure hands back the text and
 * lets the caller's state check reject it, instead of surfacing a parser error
 * to the user. Parsing never yields null, which keeps a state lookup on the
 * result safe.
 */
export async function postJSON(
  path: string,
  body: unknown,
  { signal }: PostJSONOptions = {}
): Promise<PostJSONResult> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Kopano-Konnect-XSRF': '1'
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new ExtendedError(ERROR_HTTP_NETWORK_ERROR);
  }

  const text = await response.text();
  let data: unknown;
  try {
    const parsed: unknown = JSON.parse(text);
    data = parsed === null ? text : parsed;
  } catch {
    data = text;
  }

  return {
    status: response.status,
    headers: response.headers,
    data
  };
}

/*
 * isAbortError reports whether a rejection came from the caller aborting the
 * request. An abort is not a failure to show anyone, so the thunks stay silent
 * for it: they dispatch nothing and leave the state as it was.
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}
