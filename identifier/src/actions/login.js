import queryString from 'query-string';

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

import * as types from './types';
import { receiveHello } from './common';
import { postJSON, isAbortError } from './utils';

// Modes for logon.
export const ModeLogonUsernameEmptyPasswordCookie = '0';
export const ModeLogonUsernamePassword = '1';

export function updateInput(name, value) {
  return {
    type: types.UPDATE_INPUT,
    name,
    value
  };
}

export function receiveValidateLogon(errors) {
  return {
    type: types.RECEIVE_VALIDATE_LOGON,
    errors
  };
}

export function requestLogon(username, password) {
  return {
    type: types.REQUEST_LOGON,
    username,
    password
  };
}

export function receiveLogon(logon) {
  const { success, errors } = logon;

  return {
    type: types.RECEIVE_LOGON,
    success,
    errors
  };
}

export function requestConsent(allow=false) {
  return {
    type: allow ? types.REQUEST_CONSENT_ALLOW : types.REQUEST_CONSENT_CANCEL
  };
}

export function receiveConsent(logon) {
  const { success, errors } = logon;

  return {
    type: types.RECEIVE_CONSENT,
    success,
    errors
  };
}

export function executeLogon(username, password, mode=ModeLogonUsernamePassword, options={}) {
  return async (dispatch, getState) => {
    dispatch(requestLogon(username, password));
    dispatch(receiveHello({
      username
    })); // Reset any hello state on logon.

    const { flow, query } = getState().common;

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
    try {
      const { status, headers, data } = await postJSON('./identifier/_/logon', r, options);

      let response;
      switch (status) {
        case 200:
          // success.
          response = data;
          break;
        case 204:
          // login failed. The state travels in a header, because there is no
          // body to carry it.
          response = {
            success: false,
            state: headers.get('Kopano-Konnect-State'),
            errors: {
              http: new Error(ERROR_LOGIN_FAILED)
            }
          };
          break;
        default:
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }

      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: response.state });
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
      return response;
    } catch (error) {
      // An abort is nobody's failure to report, so it resolves to the same
      // shape without an error attached.
      if (isAbortError(error)) {
        return { success: false, errors: {} };
      }

      const errors = {
        http: error
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors
      };
    }
  };
}

export function executeConsent(allow=false, scope='', options={}) {
  return async (dispatch, getState) => {
    dispatch(requestConsent(allow));

    const { query } = getState().common;

    const r = withClientRequestState({
      allow,
      scope,
      client_id: query.client_id || '',
      redirect_uri: query.redirect_uri || '',
      ref: query.state || '',
      flow_nonce: query.nonce || ''
    });
    try {
      const { status, headers, data } = await postJSON('./identifier/_/consent', r, options);

      let response;
      switch (status) {
        case 200:
          // success.
          response = data;
          break;
        case 204:
          // cancel reply. The state travels in a header, because there is no
          // body to carry it.
          response = {
            success: true,
            state: headers.get('Kopano-Konnect-State')
          };
          break;
        default:
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }

      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: response.state });
      }

      dispatch(receiveConsent(response));
      return response;
    } catch (error) {
      // An abort is nobody's failure to report, so it resolves to the same
      // shape without an error attached.
      if (isAbortError(error)) {
        return { success: false, errors: {} };
      }

      const errors = {
        http: error
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors
      };
    }
  };
}

export function validateUsernamePassword(username, password, isSignedIn) {
  return (dispatch) => new Promise((resolve, reject) => {
      const errors = {};

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
}

export function executeLogonIfFormValid(username, password, isSignedIn, options={}) {
  return (dispatch) => {
    return dispatch(
      validateUsernamePassword(username, password, isSignedIn)
    ).then(() => {
      const mode = isSignedIn ? ModeLogonUsernameEmptyPasswordCookie : ModeLogonUsernamePassword;
      return dispatch(executeLogon(username, password, mode, options));
    }).catch((errors) => {
      return {
        success: false,
        errors: errors
      };
    });
  };
}

export function advanceLogonFlow(success, history, done=false, extraQuery={}) {
  return (dispatch, getState) => {
    if (!success) {
      return;
    }

    const { flow, query, hello } = getState().common;
    const q = Object.assign({}, query, extraQuery);

    switch (flow) {
      case 'oauth':
      case 'consent':
      case 'oidc':
        if (hello.details.flow !== flow) {
          // Ignore requested flow if hello flow does not match.
          break;
        }

        if (!done && hello.details.next === 'consent') {
          history.replace(`/consent${history.location.search}${history.location.hash}`);
          return;
        }
        if (hello.details.continue_uri) {
          q.prompt = 'none';
          window.location.replace(`${hello.details.continue_uri}?${queryString.stringify(q)}`);
          return;
        }

        break;

      default:
        // Legacy stupid modes.
        if (q.continue && q.continue.indexOf(document.location.origin) === 0) {
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
