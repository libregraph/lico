import { handleAxiosError } from './utils';
import {
  ERROR_HTTP_NETWORK_ERROR,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ExtendedError
} from '../errors';

describe('handleAxiosError', () => {
  it('turns a response with an unexpected status into a translatable error', () => {
    const response = { status: 502, statusText: 'Bad Gateway', data: 'failed' };

    const error = handleAxiosError({ request: {}, response });

    expect(error).toBeInstanceOf(ExtendedError);
    expect(error.message).toBe(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS);
  });

  it('keeps the response as the values of the error', () => {
    // The message template interpolates {{status}}, so the whole response has
    // to travel with the error to the point where it is rendered.
    const response = { status: 502, statusText: 'Bad Gateway' };

    const error = handleAxiosError({ request: {}, response });

    expect(error.values).toBe(response);
  });

  it('turns a request that never got a response into a network error', () => {
    const error = handleAxiosError({ request: {} });

    expect(error).toBeInstanceOf(ExtendedError);
    expect(error.message).toBe(ERROR_HTTP_NETWORK_ERROR);
  });

  it('leaves a network error without values', () => {
    expect(handleAxiosError({ request: {} }).values).toBeUndefined();
  });

  it('passes an error which is not about a request through unchanged', () => {
    // A programming error thrown inside a thunk must not be disguised as a
    // connection problem.
    const original = new TypeError('reading of undefined');

    expect(handleAxiosError(original)).toBe(original);
  });

  it('passes an already extended error through unchanged', () => {
    const original = new ExtendedError(ERROR_HTTP_NETWORK_ERROR);

    expect(handleAxiosError(original)).toBe(original);
  });
});
