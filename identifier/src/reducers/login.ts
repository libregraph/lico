import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import type { AttemptResult, FieldErrors } from "../models/api";
import type { RootState } from "../store";

export interface LoginState {
  /*
   * Empty when nothing is in flight, otherwise the type of the action which
   * started it, so the button that was pressed is the one that shows progress.
   * Consumers compare against the creator's own `type`, which is why nothing
   * here can drift out of step with what the reducer stores.
   */
  loading: string;
  errors: FieldErrors;
}

/*
 * Neither credential is here, and no action carries one either. Anything
 * dispatched is recorded by the devtools alongside the state it produced, so a
 * password in either place outlives the request it was typed for, and a
 * username is the form's business for exactly as long as the form is on screen.
 * Both fields live in the component; the thunks are handed their values.
 *
 * What does belong here is what the server and the validator said about them:
 * `errors` is rendered by the form, and cleared field by field as they are
 * edited.
 */
const initialState: LoginState = {
  loading: "",
  errors: {},
};

export const loginSlice = createSlice({
  name: "login",
  initialState,
  reducers: {
    receiveValidateLogon: (state, { payload }: PayloadAction<FieldErrors>) => {
      state.errors = payload;
      state.loading = "";
    },

    // The payload the credentials used to travel in is gone: the reducer never
    // read it, and the devtools log every action.
    requestLogon: (state, action: PayloadAction<void>) => {
      state.loading = action.type;
      state.errors = {};
    },

    requestConsentAllow: (state, action: PayloadAction<void>) => {
      state.loading = action.type;
      state.errors = {};
    },

    requestConsentCancel: (state, action: PayloadAction<void>) => {
      state.loading = action.type;
      state.errors = {};
    },

    // A successful attempt leaves the state alone: the flow navigates away, and
    // clearing the fields here would blank the form behind that transition.
    receiveLogon: (state, { payload }: PayloadAction<AttemptResult>) => {
      if (!payload.success) {
        state.errors = payload.errors ?? {};
        state.loading = "";
      }
    },

    receiveConsent: (state, { payload }: PayloadAction<AttemptResult>) => {
      if (!payload.success) {
        state.errors = payload.errors ?? {};
        state.loading = "";
      }
    },

    /*
     * Both field values are the component's, so this only withdraws the
     * complaint about one of them. Without it a stale "enter your password"
     * would stay on screen while the user is typing one.
     */
    clearFieldError: (state, { payload }: PayloadAction<"username" | "password">) => {
      delete state.errors[payload];
    },
  },
});

export const {
  clearFieldError,
  receiveConsent,
  receiveLogon,
  receiveValidateLogon,
  requestConsentAllow,
  requestConsentCancel,
  requestLogon,
} = loginSlice.actions;

export const selectLoading = (state: RootState): LoginState["loading"] => state.login.loading;
export const selectErrors = (state: RootState): LoginState["errors"] => state.login.errors;
