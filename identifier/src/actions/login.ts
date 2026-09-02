import type { History } from "history";
import queryString from "query-string";

import {
  asError,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ERROR_LOGIN_FAILED,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME,
  ExtendedError,
} from "../errors";
import type { AttemptResult, FieldErrors, HelloResponse } from "../models/api";
import { newHelloRequest } from "../models/hello";
import { receiveHello } from "../reducers/common";
import {
  receiveConsent,
  receiveLogon,
  receiveValidateLogon,
  requestConsentAllow,
  requestConsentCancel,
  requestLogon,
} from "../reducers/login";
import type { AppThunk } from "../store";
import { withClientRequestState, withSearchAndHash } from "../utils";
import type { PostJSONOptions } from "./utils";
import { isAbortError, postJSON } from "./utils";

// Modes for logon.
export const ModeLogonUsernameEmptyPasswordCookie = "0";
export const ModeLogonUsernamePassword = "1";

export type LogonMode = typeof ModeLogonUsernameEmptyPasswordCookie | typeof ModeLogonUsernamePassword;

export function executeLogon(
  username: string,
  password: string,
  mode: LogonMode = ModeLogonUsernamePassword,
  options: PostJSONOptions = {},
): AppThunk<Promise<AttemptResult>> {
  return async (dispatch, getState): Promise<AttemptResult> => {
    dispatch(requestLogon({ username, password }));
    dispatch(
      receiveHello({
        username,
      }),
    ); // Reset any hello state on logon.

    const { flow, query } = getState().common;

    // Prepare params based on mode.
    const params: string[] = [];
    switch (mode) {
      case ModeLogonUsernamePassword:
        // Username with password.
        params.push(username, password, mode);
        break;

      case ModeLogonUsernameEmptyPasswordCookie:
        // Username with empty password - this only works when the user is already signed in.
        params.push(username, "", mode);
        break;

      default:
    }

    const r = withClientRequestState({
      params: params,
      hello: newHelloRequest(flow, query),
    });
    try {
      const { status, headers, data } = await postJSON("./identifier/_/logon", r, options);

      let response: AttemptResult;
      switch (status) {
        case 200:
          // success.
          response = data as AttemptResult;
          break;
        case 204:
          // login failed. The state travels in a header, because there is no
          // body to carry it.
          response = {
            success: false,
            state: headers.get("Kopano-Konnect-State"),
            errors: {
              http: { message: ERROR_LOGIN_FAILED },
            },
          };
          break;
        default:
          throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }

      if (response.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: response.state });
      }

      // A reply without a hello of its own still has to leave a session behind,
      // so the outcome and the name that was tried stand in for one.
      const hello: Partial<HelloResponse> = response.hello ?? {
        success: response.success,
        username,
      };

      dispatch(receiveHello(hello));
      dispatch(receiveLogon(response));
      return response;
    } catch (error) {
      // An abort is nobody's failure to report, so it resolves to the same
      // shape without an error attached.
      if (isAbortError(error)) {
        return { success: false, errors: {} };
      }

      const errors: FieldErrors = {
        http: asError(error),
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors,
      };
    }
  };
}

export function executeConsent(
  allow = false,
  scope = "",
  options: PostJSONOptions = {},
): AppThunk<Promise<AttemptResult>> {
  return async (dispatch, getState): Promise<AttemptResult> => {
    dispatch(allow ? requestConsentAllow() : requestConsentCancel());

    const { query } = getState().common;

    const r = withClientRequestState({
      allow,
      scope,
      client_id: query.client_id || "",
      redirect_uri: query.redirect_uri || "",
      ref: query.state || "",
      flow_nonce: query.nonce || "",
    });
    try {
      const { status, headers, data } = await postJSON("./identifier/_/consent", r, options);

      let response: AttemptResult;
      switch (status) {
        case 200:
          // success.
          response = data as AttemptResult;
          break;
        case 204:
          // cancel reply. The state travels in a header, because there is no
          // body to carry it.
          response = {
            success: true,
            state: headers.get("Kopano-Konnect-State"),
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

      const errors: FieldErrors = {
        http: asError(error),
      };

      dispatch(receiveValidateLogon(errors));
      return {
        success: false,
        errors: errors,
      };
    }
  };
}

// Validation reads the two fields and nothing else, so it is synchronous and
// returns what it found: an empty object when the form is complete. An
// incomplete form is an ordinary outcome rather than a failure, and expressing
// it as a rejected promise carrying domain data forced callers to treat it as
// one.
export function validateUsernamePassword(
  username: string,
  password: string,
  isSignedIn: boolean,
): AppThunk<FieldErrors> {
  return (dispatch) => {
    const errors: FieldErrors = {};

    if (!username) {
      errors.username = { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME };
    }
    if (!password && !isSignedIn) {
      errors.password = { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD };
    }

    dispatch(receiveValidateLogon(errors));

    return errors;
  };
}

export function executeLogonIfFormValid(
  username: string,
  password: string,
  isSignedIn: boolean,
  options: PostJSONOptions = {},
): AppThunk<Promise<AttemptResult>> {
  return (dispatch) => {
    const errors = dispatch(validateUsernamePassword(username, password, isSignedIn));
    if (Object.keys(errors).length > 0) {
      return Promise.resolve({
        success: false,
        errors: errors,
      });
    }

    const mode = isSignedIn ? ModeLogonUsernameEmptyPasswordCookie : ModeLogonUsernamePassword;
    return dispatch(executeLogon(username, password, mode, options));
  };
}

export function advanceLogonFlow(
  success: boolean,
  history: History,
  done = false,
  extraQuery: Record<string, string | null | undefined> = {},
): AppThunk {
  return (dispatch, getState) => {
    if (!success) {
      return;
    }

    const { flow, query, hello } = getState().common;
    const q: Record<string, string | null | undefined> = Object.assign({}, query, extraQuery);

    switch (flow) {
      case "oauth":
      case "consent":
      case "oidc":
        if (hello?.details.flow !== flow) {
          // Ignore requested flow if hello flow does not match.
          break;
        }

        if (!done && hello.details.next === "consent") {
          history.replace(withSearchAndHash("/consent", history.location));
          return;
        }
        if (hello.details.continue_uri) {
          q.prompt = "none";
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
    let target = "/welcome";
    if (history.action === "REPLACE") {
      target = withSearchAndHash(target, history.location);
    }

    dispatch(receiveValidateLogon({})); // XXX(longsleep): hack to reset loading and errors.
    history.push(target);
  };
}
