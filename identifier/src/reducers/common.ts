import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import type { TranslatableError } from "../errors";
import type { Branding, HelloResponse, Session } from "../models/api";
import type { RootState } from "../store";

/*
 * Everything the server told us about who this is. The request's own
 * parameters are not here: they never change, and they are a SignInRequest.
 */
export interface CommonState {
  hello: Session | null;
  branding: Branding | null;
  error: TranslatableError | null;
}

const initialState: CommonState = {
  hello: null,
  branding: null,
  error: null,
};

export const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {
    receiveError: (state, { payload }: PayloadAction<TranslatableError | null>) => {
      state.error = payload;
    },

    resetHello: (state) => {
      state.hello = null;
      state.branding = null;
    },

    receiveHello: (state, { payload }: PayloadAction<Partial<HelloResponse>>) => {
      state.hello = {
        state: payload.success === true,
        username: payload.username,
        displayName: payload.displayName,
        details: payload,
      };

      // A reply carrying no branding leaves what was already there, so the
      // screens do not lose their logo when a later request answers without it.
      if (payload.branding) {
        state.branding = payload.branding;
      }
    },
  },
});

export const { receiveError, receiveHello, resetHello } = commonSlice.actions;

export const selectHello = (state: RootState): CommonState["hello"] => state.common.hello;
export const selectBranding = (state: RootState): CommonState["branding"] => state.common.branding;
export const selectError = (state: RootState): CommonState["error"] => state.common.error;
