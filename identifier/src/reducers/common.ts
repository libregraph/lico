import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import queryString from "query-string";

import type { TranslatableError } from "../errors";
import type { Branding, HelloResponse, Session } from "../models/api";
import type { RootState } from "../store";

/*
 * query-string hands back an array when a parameter repeats. Every reader here
 * treats these as single values, and the OIDC request parameters are single
 * valued, so the map is named as strings rather than teaching each reader to
 * unwrap one.
 */
const query = queryString.parse(document.location.search) as Record<string, string>;
const flow = query.flow || "";
delete query.flow;

const defaultPathPrefix = (() => {
  const root = document.getElementById("root");
  let pathPrefix = root ? root.getAttribute("data-path-prefix") : null;
  if (!pathPrefix || pathPrefix === "__PATH_PREFIX__") {
    // Not replaced, probably we are running in debug mode or whatever. Use sane default.
    pathPrefix = "/signin/v1";
  }
  return pathPrefix;
})();

export interface CommonState {
  hello: Session | null;
  branding: Branding | null;
  error: TranslatableError | null;
  flow: string;
  query: Record<string, string>;
  pathPrefix: string;
}

const initialState: CommonState = {
  hello: null,
  branding: null,
  error: null,
  flow: flow,
  query: query,
  pathPrefix: defaultPathPrefix,
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
export const selectFlow = (state: RootState): CommonState["flow"] => state.common.flow;
export const selectQuery = (state: RootState): CommonState["query"] => state.common.query;
export const selectPathPrefix = (state: RootState): CommonState["pathPrefix"] => state.common.pathPrefix;
