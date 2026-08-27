import loginReducer from './login';
import {
  receiveConsent,
  receiveLogon,
  receiveValidateLogon,
  requestConsent,
  requestLogon,
  updateInput
} from '../actions/login';
import { receiveLogoff } from '../actions/common';
import {
  RECEIVE_CONSENT,
  RECEIVE_LOGON,
  REQUEST_CONSENT_ALLOW,
  REQUEST_CONSENT_CANCEL,
  REQUEST_LOGON
} from '../actions/types';
import {
  ERROR_LOGIN_FAILED,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME,
  ExtendedError
} from '../errors';
import { LoginState, StateResponse } from '../test-utils';

const initial = (): LoginState => loginReducer(undefined, { type: '@@INIT' });

// The reducer is driven with the real action creators so that a rename or a
// changed payload shape on either side breaks the test.
describe('loginReducer', () => {
  it('starts idle with empty credentials and no errors', () => {
    expect(initial()).toEqual({
      loading: '',
      username: '',
      password: '',
      errors: {}
    });
  });

  it('stores the errors reported by client side validation and stops loading', () => {
    const errors: Record<string, Error> = {
      username: new ExtendedError(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME),
      password: new ExtendedError(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD)
    };
    const pending = loginReducer(initial(), requestLogon('user1', 'secret'));

    const state = loginReducer(pending, receiveValidateLogon(errors));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe('');
  });

  it('marks a logon request as loading with its own action type', () => {
    // Components render their spinner by comparing loading against the
    // imported constant, so the stored value has to be that exact string.
    const state = loginReducer(initial(), requestLogon('user1', 'secret'));

    expect(state.loading).toBe(REQUEST_LOGON);
  });

  it('marks a consent allow request as loading with its own action type', () => {
    const state = loginReducer(initial(), requestConsent(true));

    expect(state.loading).toBe(REQUEST_CONSENT_ALLOW);
  });

  it('marks a consent cancel request as loading with its own action type', () => {
    const state = loginReducer(initial(), requestConsent(false));

    expect(state.loading).toBe(REQUEST_CONSENT_CANCEL);
  });

  it('defaults a consent request without an argument to cancel', () => {
    expect(requestConsent().type).toBe(REQUEST_CONSENT_CANCEL);
  });

  it('discards previous errors when a new request starts', () => {
    const failed = loginReducer(
      initial(),
      receiveValidateLogon({ username: new ExtendedError(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME) })
    );

    expect(loginReducer(failed, requestLogon('user1', 'secret')).errors).toEqual({});
    expect(loginReducer(failed, requestConsent(true)).errors).toEqual({});
    expect(loginReducer(failed, requestConsent(false)).errors).toEqual({});
  });

  it('stores the errors of a failed logon and stops loading', () => {
    const errors: Record<string, Error> = {
      http: new ExtendedError(ERROR_LOGIN_FAILED)
    };
    const pending = loginReducer(initial(), requestLogon('user1', 'wrong'));

    const state = loginReducer(pending, receiveLogon({ success: false, errors }));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe('');
  });

  it('falls back to an empty error map when a failed logon reports no errors', () => {
    const pending = loginReducer(initial(), requestLogon('user1', 'wrong'));

    const state = loginReducer(pending, receiveLogon({ success: false }));

    expect(state.errors).toEqual({});
    expect(state.loading).toBe('');
  });

  it('leaves the state untouched on a successful logon', () => {
    // The success path navigates away, so the loading flag is kept on purpose
    // and the state object must not be replaced.
    const pending = loginReducer(initial(), requestLogon('user1', 'secret'));

    expect(loginReducer(pending, receiveLogon({ success: true }))).toBe(pending);
  });

  it('stores the errors of a failed consent and stops loading', () => {
    const errors: Record<string, Error> = {
      http: new ExtendedError(ERROR_LOGIN_FAILED)
    };
    const pending = loginReducer(initial(), requestConsent(true));

    const state = loginReducer(pending, receiveConsent({ success: false, errors }));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe('');
  });

  it('falls back to an empty error map when a failed consent reports no errors', () => {
    const pending = loginReducer(initial(), requestConsent(false));

    const state = loginReducer(pending, receiveConsent({ success: false }));

    expect(state.errors).toEqual({});
    expect(state.loading).toBe('');
  });

  it('leaves the state untouched on a successful consent', () => {
    const pending = loginReducer(initial(), requestConsent(true));

    expect(loginReducer(pending, receiveConsent({ success: true }))).toBe(pending);
  });

  it('names the received action after the logon or the consent it answers', () => {
    expect(receiveLogon({ success: true }).type).toBe(RECEIVE_LOGON);
    expect(receiveConsent({ success: true }).type).toBe(RECEIVE_CONSENT);
  });

  it('forgets the credentials after a logoff', () => {
    const typed = loginReducer(
      loginReducer(initial(), updateInput('username', 'user1@example.com')),
      updateInput('password', 'secret')
    );
    const response: StateResponse = { success: true, state: 'nonce' };

    const state = loginReducer(typed, receiveLogoff(response));

    expect(state.username).toBe('');
    expect(state.password).toBe('');
  });

  it('records the value typed into a named field', () => {
    const state = loginReducer(initial(), updateInput('username', 'user1@example.com'));

    expect(state.username).toBe('user1@example.com');
    expect(state.password).toBe('');
  });

  it('clears the error of a field as soon as it is edited', () => {
    // Typing has to make the inline validation message disappear, otherwise the
    // user sees a stale complaint about input they already corrected.
    const invalid = loginReducer(
      initial(),
      receiveValidateLogon({
        username: new ExtendedError(ERROR_LOGIN_VALIDATE_MISSINGUSERNAME),
        password: new ExtendedError(ERROR_LOGIN_VALIDATE_MISSINGPASSWORD)
      })
    );

    const state: LoginState = loginReducer(invalid, updateInput('username', 'u'));

    expect(state.errors.username).toBeUndefined();
    expect(state.errors.password).toBeDefined();
  });

  it('returns the same state object for an unrelated action', () => {
    const before = initial();

    expect(loginReducer(before, { type: 'SOMETHING_ELSE' })).toBe(before);
  });
});
