import type { FieldErrors, HelloResponse } from '../models/api';

export const RECEIVE_ERROR = 'RECEIVE_ERROR';

export const RESET_HELLO = 'RESET_HELLO';
export const EXECUTE_HELLO = 'EXECUTE_HELLO';
export const RECEIVE_HELLO = 'RECEIVE_HELLO';

export const RECEIVE_VALIDATE_LOGON = 'RECEIVE_VALIDATE_LOGON';
export const REQUEST_LOGON = 'REQUEST_LOGON';
export const EXECUTE_LOGON = 'EXECUTE_LOGON';
export const RECEIVE_LOGON = 'RECEIVE_LOGON';
export const UPDATE_INPUT = 'UPDATE_INPUT';

export const REQUEST_CONSENT_ALLOW = 'REQUEST_CONSENT_ALLOW';
export const REQUEST_CONSENT_CANCEL = 'REQUEST_CONSENT_CANCEL';
export const EXECUTE_CONSENT = 'EXECUTE_CONSENT';
export const RECEIVE_CONSENT = 'RECEIVE_CONSENT';

export const REQUEST_LOGOFF = 'REQUEST_LOGOFF';
export const EXECUTE_LOGOFF = 'EXECUTE_LOGOFF';
export const RECEIVE_LOGOFF = 'RECEIVE_LOGOFF';

/*
 * The dispatched actions, named so that a reducer reading a member and a
 * creator producing one cannot drift apart. The four EXECUTE_ constants above
 * are declared for symmetry with the naming scheme and are never dispatched:
 * the executing is done by thunks, which need no action type of their own.
 */

export interface ReceiveErrorAction {
  type: typeof RECEIVE_ERROR;
  error: Error | null;
}

export interface ResetHelloAction {
  type: typeof RESET_HELLO;
}

export interface ReceiveHelloAction {
  type: typeof RECEIVE_HELLO;
  state: boolean;
  username?: string;
  displayName?: string;
  hello: Partial<HelloResponse>;
}

export interface RequestLogoffAction {
  type: typeof REQUEST_LOGOFF;
}

export interface ReceiveLogoffAction {
  type: typeof RECEIVE_LOGOFF;
  state: boolean;
}

export interface UpdateInputAction {
  type: typeof UPDATE_INPUT;
  name: string;
  value: string;
}

export interface ReceiveValidateLogonAction {
  type: typeof RECEIVE_VALIDATE_LOGON;
  errors: FieldErrors;
}

export interface RequestLogonAction {
  type: typeof REQUEST_LOGON;
  username: string;
  password: string;
}

export interface ReceiveLogonAction {
  type: typeof RECEIVE_LOGON;
  success: boolean;
  errors?: FieldErrors;
}

// Allowing and refusing differ only in the type, which the login slice records
// so the right button can show progress.
export interface RequestConsentAction {
  type: typeof REQUEST_CONSENT_ALLOW | typeof REQUEST_CONSENT_CANCEL;
}

export interface ReceiveConsentAction {
  type: typeof RECEIVE_CONSENT;
  success: boolean;
  errors?: FieldErrors;
}

export type AppAction =
  | ReceiveErrorAction
  | ResetHelloAction
  | ReceiveHelloAction
  | RequestLogoffAction
  | ReceiveLogoffAction
  | UpdateInputAction
  | ReceiveValidateLogonAction
  | RequestLogonAction
  | ReceiveLogonAction
  | RequestConsentAction
  | ReceiveConsentAction;
