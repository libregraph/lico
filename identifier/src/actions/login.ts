import axios from 'axios';
import queryString from 'query-string';
import { Dispatch, AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import { newHelloRequest } from '../models/hello';
import { withClientRequestState } from '../utils';
import {
  ExtendedError,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_FAILED,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE
} from '../errors';

import { receiveHello } from './common';
import { handleAxiosError } from './utils';
import { createSerializableError } from '../utils/serializeError';
import { 
  updateInput as updateInputAction,
  receiveValidateLogon as receiveValidateLogonAction,
  requestLogon as requestLogonAction,
  receiveLogon as receiveLogonAction,
  requestConsentAllow as requestConsentAllowAction,
  requestConsentCancel as requestConsentCancelAction,
  receiveConsent as receiveConsentAction
} from '../reducers/login';
import { RootState } from '../store';
import { LoginError } from '../types/common';

// Modes for logon.
export const ModeLogonUsernameEmptyPasswordCookie = '0';
export const ModeLogonUsernamePassword = '1';

interface LogonResponse {
  success: boolean;
  errors?: LoginError;
}

interface ThunkResponse<T = unknown> {
  success: boolean;
  errors?: LoginError;
  data?: T;
}

export function updateInput(name: string, value: string) {
  return updateInputAction({ name, value });
}

export function receiveValidateLogon(errors: LoginError) {
  return receiveValidateLogonAction({ errors });
}

export function requestLogon(username: string, password: string) {
  return requestLogonAction({ username, password });
}

export function receiveLogon(logon: LogonResponse) {
  const { success, errors } = logon;

  return receiveLogonAction({ success, errors });
}

export function requestConsent(allow: boolean = false) {
  return allow ? requestConsentAllowAction() : requestConsentCancelAction();
}

export function receiveConsent(logon: LogonResponse) {
  const { success, errors } = logon;

  return receiveConsentAction({ success, errors });
}

export function executeLogon(username: string, password: string, mode: string = ModeLogonUsernamePassword): ThunkAction<Promise<any>, RootState, unknown, any> {
  return function(dispatch: Dispatch, getState: () => RootState) {
    dispatch(requestLogon(username, password));
    dispatch(receiveHello({
      success: false,
      username
    })); // Reset any hello state on logon.

    const { flow, query, pathPrefix } = getState().common;

    // Prepare params based on mode.
    const params = [];
    switch (mode) {
      case ModeLogonUsernamePassword:
        // Username with password.
        params.push(username, password, mode);
        break;

      case ModeLogonUsernameEmptyPasswordCookie:
        // Username with empty password - this only works when the user is already signed in.
        params.push(username, '', mode);
        break;

      default:
    }

    const r = withClientRequestState({
      params: params,
      hello: newHelloRequest(flow, query)
    });
    return axios.post(`${pathPrefix}/identifier/_/logon`, r, {
      headers: {
        'Kopano-Konnect-XSRF': '1'
      }
    }).then(response => {
      switch (response.status) {
        case 200:
          // success.
          return response.data;
        case 204:
          // login failed.
          return {
            success: false,
            state: response.headers['kopano-konnect-state'],
            errors: {
              http: createSerializableError(ERROR_LOGIN_FAILED)
            }
          };
        default:
          // error.
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, response);
      }
    }).then(response => {
      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, response);
      }

      let { hello } = response;
      if (!hello) {
        hello = {
          success: response.success,
          username
        };
      }
      dispatch(receiveHello(hello));
      dispatch(receiveLogon(response));
      return Promise.resolve(response);
    }).catch(error => {
      error = handleAxiosError(error);
      const errors = {
        http: error
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors
      };
    });
  };
}

export function executeConsent(allow: boolean = false, scope: string = ''): ThunkAction<Promise<any>, RootState, unknown, any> {
  return function(dispatch: Dispatch, getState: () => RootState) {
    dispatch(requestConsent(allow));

    const { query, pathPrefix } = getState().common;

    const r = withClientRequestState({
      allow,
      scope,
      client_id: query.client_id || '', // eslint-disable-line camelcase
      redirect_uri: query.redirect_uri || '', // eslint-disable-line camelcase
      ref: query.state || '',
      flow_nonce: query.nonce || '' // eslint-disable-line camelcase
    });
    return axios.post(`${pathPrefix}/identifier/_/consent`, r, {
      headers: {
        'Kopano-Konnect-XSRF': '1'
      }
    }).then(response => {
      switch (response.status) {
        case 200:
          // success.
          return response.data;
        case 204:
          // cancel reply.
          return {
            success: true,
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

      dispatch(receiveConsent(response));
      return Promise.resolve(response);
    }).catch(error => {
      error = handleAxiosError(error);
      const errors = {
        http: error
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors
      };
    });
  };
}

export function validateUsernamePassword(username: string, password: string, isSignedIn: boolean): ThunkAction<Promise<any>, RootState, unknown, any> {
  return function(dispatch: Dispatch) {
    return new Promise((resolve, reject) => {
      const errors: LoginError = {};

      if (!username) {
        errors.username = new Error(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME);
      }
      if (!password && !isSignedIn) {
        errors.password = new Error(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD);
      }

      dispatch(receiveValidateLogon(errors));
      if (Object.keys(errors).length === 0) {
        resolve(errors);
      } else {
        reject(errors);
      }
    });
  };
}

export function executeLogonIfFormValid(username: string, password: string, isSignedIn: boolean) {
  return (dispatch: Dispatch<AnyAction>) => {
    return (dispatch(
      validateUsernamePassword(username, password, isSignedIn) as any
    ) as any).then(() => {
      const mode = isSignedIn ? ModeLogonUsernameEmptyPasswordCookie : ModeLogonUsernamePassword;
      return dispatch(executeLogon(username, password, mode) as any);
    }).catch((errors: unknown) => {
      return {
        success: false,
        errors: errors
      };
    });
  };
}

interface HistoryLike {
  push: (path: string) => void;
  replace: (path: string) => void;
  location: {
    search: string;
    hash: string;
  };
  action: string;
}

export function advanceLogonFlow(success: boolean, history: HistoryLike, done: boolean = false, extraQuery: Record<string, unknown> = {}) {
  return (dispatch: Dispatch, getState: () => RootState) => {
    if (!success) {
      return;
    }

    const { flow, query, hello } = getState().common;
    const q = Object.assign({}, query, extraQuery);

    switch (flow) {
      case 'oauth':
      case 'consent':
      case 'oidc':
        if (hello && hello.details.flow !== flow) {
          // Ignore requested flow if hello flow does not match.
          break;
        }

        if (!done && hello && hello.details.next === 'consent') {
          history.replace(`/consent${history.location.search}${history.location.hash}`);
          return;
        }
        if (hello && hello.details.continue_uri) {
          q.prompt = 'none';
          window.location.replace(hello.details.continue_uri + '?' + queryString.stringify(q));
          return;
        }

        break;

      default:
        // Legacy stupid modes.
        if (q.continue && typeof q.continue === 'string' && q.continue.indexOf(document.location.origin) === 0) {
          window.location.replace(q.continue);
          return;
        }
    }

    // Default action.
    let target = '/welcome';
    if (history.action === 'REPLACE') {
      target = target + history.location.search + history.location.hash;
    }

    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
    history.push(target);
  };
}
