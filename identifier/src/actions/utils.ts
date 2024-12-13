import { AxiosError } from 'axios';
import {
  ExtendedError,
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS
} from '../errors';

export function handleAxiosError(error: AxiosError | ExtendedError) {
  if ((error as AxiosError).request) {
    // Axios errors.
    if ((error as AxiosError).response) {
      error = new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, (error as AxiosError).response);
    } else {
      error = new ExtendedError(ERROR_HTTP_NETWORK_ERROR);
    }
  }

  return error;
}
