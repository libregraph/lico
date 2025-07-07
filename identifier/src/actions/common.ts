import axios from 'axios';
import { Dispatch, AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { newHelloRequest } from '../models/hello';
import { withClientRequestState } from '../utils';
import {
  ExtendedError,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE
} from '../errors';

import { handleAxiosError } from './utils';
import { receiveError as receiveErrorAction, resetHello as resetHelloAction, receiveHello as receiveHelloAction } from '../reducers/common';
import { receiveLogoff as receiveLogoffAction } from '../reducers/login';
import { RootState } from '../store';

export const receiveError = receiveErrorAction;
export const resetHello = resetHelloAction;

interface HelloResponse {
  success: boolean;
  username?: string;
  displayName?: string;
  state?: string;
}

export function receiveHello(hello: HelloResponse) {
  const { success, username, displayName } = hello;

  return receiveHelloAction({
    state: success === true,
    username,
    displayName,
    hello
  });
}

export function executeHello(): ThunkAction<Promise<any>, RootState, unknown, any> {
  return function(dispatch: Dispatch, getState: () => RootState) {
    dispatch(resetHello());

    const { flow, query, pathPrefix } = getState().common;

    const r = withClientRequestState(newHelloRequest(flow, query));
    return axios.post(`${pathPrefix}/identifier/_/hello`, r, {
      headers: {
        'Kopano-Konnect-XSRF': '1'
      }
    }).then(response => {
      switch (response.status) {
        case 200:
          // success.
          return response.data;
        case 204:
          // not signed-in.
          return {
            success: false,
            state: response.headers['kopano-konnect-state']
          };
        default:
          // error.
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, response);
      }
    }).then(response => {
      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, response);
      }

      dispatch(receiveHello(response));
      return Promise.resolve(response);
    }).catch(error => {
      error = handleAxiosError(error);

      dispatch(receiveError({ error }));
    });
  };
}

export function retryHello() {
  return function(dispatch: Dispatch<AnyAction>) {
    dispatch(receiveError({ error: null }));

    return dispatch(executeHello() as any);
  };
}

// This doesn't need a separate action in RTK as it's handled by the async thunk
export function requestLogoff() {
  // No-op for backward compatibility, actual state is managed in executeLogoff
  return { type: 'REQUEST_LOGOFF' };
}

export const receiveLogoff = receiveLogoffAction;

export function executeLogoff() {
  return function(dispatch: Dispatch, getState: () => RootState) {
    dispatch(resetHello());
    dispatch(requestLogoff());

    const { pathPrefix } = getState().common;
    const r = withClientRequestState({});
    return axios.post(`${pathPrefix}/identifier/_/logoff`, r, {
      headers: {
        'Kopano-Konnect-XSRF': '1'
      }
    }).then(response => {
      switch (response.status) {
        case 200:
          // success.
          return response.data;
        default:
          // error.
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, response);
      }
    }).then(response => {
      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, response);
      }

      dispatch(receiveLogoff());
      return Promise.resolve(response);
    }).catch(error => {
      error = handleAxiosError(error);

      dispatch(receiveError({ error }));
    });
  };
}
