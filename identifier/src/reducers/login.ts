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
  username: string;
  password: string;
  errors: FieldErrors;
}

const initialState: LoginState = {
  loading: "",
  username: "",
  password: "",
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

    requestLogon: (state, action: PayloadAction<{ username: string; password: string }>) => {
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

    receiveLogoff: (state) => {
      state.username = "";
      state.password = "";
    },

    updateInput: (state, { payload }: PayloadAction<{ name: "username" | "password"; value: string }>) => {
      // Editing a field clears the error recorded for it.
      delete state.errors[payload.name];
      state[payload.name] = payload.value;
    },
  },
});

export const {
  receiveConsent,
  receiveLogoff,
  receiveLogon,
  receiveValidateLogon,
  requestConsentAllow,
  requestConsentCancel,
  requestLogon,
  updateInput,
} = loginSlice.actions;

export const selectLoading = (state: RootState): LoginState["loading"] => state.login.loading;
export const selectUsername = (state: RootState): LoginState["username"] => state.login.username;
export const selectPassword = (state: RootState): LoginState["password"] => state.login.password;
export const selectErrors = (state: RootState): LoginState["errors"] => state.login.errors;
