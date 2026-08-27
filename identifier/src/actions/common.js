import { newHelloRequest } from '../models/hello';

import { withClientRequestState } from '../utils';
import {
  ExtendedError,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE
} from '../errors';

import { postJSON, isAbortError } from './utils';
import * as types from './types';

export function receiveError(error) {
  return {
    type: types.RECEIVE_ERROR,
    error
  };
}

export function resetHello() {
  return {
    type: types.RESET_HELLO
  };
}

export function receiveHello(hello) {
  const { success, username, displayName } = hello;

  return {
    type: types.RECEIVE_HELLO,
    state: success === true,
    username,
    displayName,
    hello
  };
}

export function executeHello(options={}) {
  return async function(dispatch, getState) {
    dispatch(resetHello());

    const { flow, query } = getState().common;

    const r = withClientRequestState(newHelloRequest(flow, query));
    try {
      const { status, data } = await postJSON('./identifier/_/hello', r, options);

      // This endpoint answers 200 for both signed-in and signed-out visitors.
      if (status !== 200) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }
      if (data.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: data.state });
      }

      dispatch(receiveHello(data));
      return data;
    } catch (error) {
      if (isAbortError(error)) {
        return undefined;
      }

      dispatch(receiveError(error));
      return undefined;
    }
  };
}

export function retryHello(options={}) {
  return function(dispatch) {
    dispatch(receiveError(null));

    return dispatch(executeHello(options));
  };
}

export function requestLogoff() {
  return {
    type: types.REQUEST_LOGOFF
  };
}

export function receiveLogoff(state) {
  return {
    type: types.RECEIVE_LOGOFF,
    state
  };
}

export function executeLogoff(options={}) {
  return async function(dispatch) {
    dispatch(resetHello());
    dispatch(requestLogoff());

    const r = withClientRequestState({});
    try {
      const { status, data } = await postJSON('./identifier/_/logoff', r, options);

      if (status !== 200) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }
      if (data.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: data.state });
      }

      dispatch(receiveLogoff(data.success === true));
      return data;
    } catch (error) {
      // Callers read success off the resolved value, so a failure has to be
      // reported as one rather than as undefined. An abort reports the same
      // shape without an error, because nobody asked to be told about it.
      if (isAbortError(error)) {
        return { success: false, errors: {} };
      }

      dispatch(receiveError(error));

      return {
        success: false,
        errors: {
          http: error
        }
      };
    }
  };
}
