import {
  ExtendedError,
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS
} from '../errors';
import { serializeError } from '../utils/serializeError';

interface AxiosError {
  request?: unknown;
  response?: unknown;
}

export function handleAxiosError(error: AxiosError | Error): unknown {
  if ('request' in error && error.request) {
    // Axios errors.
    if (error.response) {
      error = new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, error.response);
    } else {
      error = new ExtendedError(ERROR_HTTP_NETWORK_ERROR);
    }
  }

  return serializeError(error);
}
