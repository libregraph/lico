import type { UnknownAction } from "@reduxjs/toolkit";

import {
  ERROR_LOGIN_FAILED,
  ERROR_LOGIN_VALIDATE_MISSINGPASSWORD,
  ERROR_LOGIN_VALIDATE_MISSINGUSERNAME,
} from "../errors";
import type { FieldErrors, LoginState } from "../test-utils";
import {
  clearFieldError,
  loginSlice,
  receiveConsent,
  receiveLogon,
  receiveValidateLogon,
  requestConsentAllow,
  requestConsentCancel,
  requestLogon,
} from "./login";

const loginReducer = loginSlice.reducer;

/*
 * Redux dispatches an initialisation action of its own, and a reducer has to
 * survive any action it does not recognise.
 */
function foreignAction(type: string): UnknownAction {
  return { type };
}

const initial = (): LoginState => loginReducer(undefined, foreignAction("@@INIT"));

// The reducer is driven with the real action creators so that a rename or a
// changed payload shape on either side breaks the test.
describe("loginReducer", () => {
  it("starts idle with no errors", () => {
    expect(initial()).toEqual({
      loading: "",
      errors: {},
    });
  });

  it("stores the errors reported by client side validation and stops loading", () => {
    const errors: FieldErrors = {
      username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
      password: { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD },
    };
    const pending = loginReducer(initial(), requestLogon());

    const state = loginReducer(pending, receiveValidateLogon(errors));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe("");
  });

  it("marks a logon request as loading with its own action type", () => {
    // Components render their spinner by comparing loading against the
    // imported constant, so the stored value has to be that exact string.
    const state = loginReducer(initial(), requestLogon());

    expect(state.loading).toBe(requestLogon.type);
  });

  it("marks a consent allow request as loading with its own action type", () => {
    const state = loginReducer(initial(), requestConsentAllow());

    expect(state.loading).toBe(requestConsentAllow.type);
  });

  it("marks a consent cancel request as loading with its own action type", () => {
    const state = loginReducer(initial(), requestConsentCancel());

    expect(state.loading).toBe(requestConsentCancel.type);
  });

  it("discards previous errors when a new request starts", () => {
    const failed = loginReducer(
      initial(),
      receiveValidateLogon({ username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME } }),
    );

    expect(loginReducer(failed, requestLogon()).errors).toEqual({});
    expect(loginReducer(failed, requestConsentAllow()).errors).toEqual({});
    expect(loginReducer(failed, requestConsentCancel()).errors).toEqual({});
  });

  it("stores the errors of a failed logon and stops loading", () => {
    const errors: FieldErrors = {
      http: { message: ERROR_LOGIN_FAILED },
    };
    const pending = loginReducer(initial(), requestLogon());

    const state = loginReducer(pending, receiveLogon({ success: false, errors }));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe("");
  });

  it("falls back to an empty error map when a failed logon reports no errors", () => {
    const pending = loginReducer(initial(), requestLogon());

    const state = loginReducer(pending, receiveLogon({ success: false }));

    expect(state.errors).toEqual({});
    expect(state.loading).toBe("");
  });

  it("leaves the state untouched on a successful logon", () => {
    // The success path navigates away, so the loading flag is kept on purpose
    // and the state object must not be replaced.
    const pending = loginReducer(initial(), requestLogon());

    expect(loginReducer(pending, receiveLogon({ success: true }))).toBe(pending);
  });

  it("stores the errors of a failed consent and stops loading", () => {
    const errors: FieldErrors = {
      http: { message: ERROR_LOGIN_FAILED },
    };
    const pending = loginReducer(initial(), requestConsentAllow());

    const state = loginReducer(pending, receiveConsent({ success: false, errors }));

    expect(state.errors).toBe(errors);
    expect(state.loading).toBe("");
  });

  it("falls back to an empty error map when a failed consent reports no errors", () => {
    const pending = loginReducer(initial(), requestConsentCancel());

    const state = loginReducer(pending, receiveConsent({ success: false }));

    expect(state.errors).toEqual({});
    expect(state.loading).toBe("");
  });

  it("leaves the state untouched on a successful consent", () => {
    const pending = loginReducer(initial(), requestConsentAllow());

    expect(loginReducer(pending, receiveConsent({ success: true }))).toBe(pending);
  });

  it("names the received action after the logon or the consent it answers", () => {
    // Spelled out rather than compared to the creator, because these strings
    // reach the devtools and a rename should be visible here.
    expect(receiveLogon({ success: true }).type).toBe("login/receiveLogon");
    expect(receiveConsent({ success: true }).type).toBe("login/receiveConsent");
  });

  it("holds neither credential, and no action carries one", () => {
    // Both fields belong to the form. Nothing here may keep them, and nothing
    // dispatched may carry them, because the devtools record state and actions
    // alike and both outlive the request the credentials were typed for.
    const state = loginReducer(loginReducer(initial(), requestLogon()), clearFieldError("username"));

    expect(state).not.toHaveProperty("password");
    expect(state).not.toHaveProperty("username");
    expect(requestLogon()).toEqual({ type: requestLogon.type, payload: undefined });
    expect(Object.keys(state)).toEqual(["loading", "errors"]);
  });

  it("clears the error of a field as soon as it is edited", () => {
    // Typing has to make the inline validation message disappear, otherwise the
    // user sees a stale complaint about input they already corrected.
    const invalid = loginReducer(
      initial(),
      receiveValidateLogon({
        username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
        password: { message: ERROR_LOGIN_VALIDATE_MISSINGPASSWORD },
      }),
    );

    const state: LoginState = loginReducer(invalid, clearFieldError("username"));

    expect(state.errors.username).toBeUndefined();
    expect(state.errors.password).toBeDefined();
  });

  it("leaves the previous state untouched when it clears a field error", () => {
    // The reducer used to delete from the incoming state's own errors object and
    // then share that object with the state it returned, so the error vanished
    // from both and replaying the previous state no longer reproduced it.
    const invalid: LoginState = loginReducer(
      initial(),
      receiveValidateLogon({
        username: { message: ERROR_LOGIN_VALIDATE_MISSINGUSERNAME },
      }),
    );

    const state: LoginState = loginReducer(invalid, clearFieldError("username"));

    expect(invalid.errors.username).toBeDefined();
    expect(state.errors).not.toBe(invalid.errors);
  });

  it("returns the same state object for an unrelated action", () => {
    const before = initial();

    expect(loginReducer(before, foreignAction("SOMETHING_ELSE"))).toBe(before);
  });
});
