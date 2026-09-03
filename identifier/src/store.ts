import type { ThunkAction, UnknownAction } from "@reduxjs/toolkit";
import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { commonSlice } from "./reducers/common";
import { loginSlice } from "./reducers/login";
import type { SignInRequest } from "./request";

/*
 * The state shape is derived from the reducers rather than from the store, so
 * that the factory below can name a preloaded state without depending on its own
 * return type. Deriving it from the store instead makes that a circular
 * reference, which TypeScript resolves to `any` in silence, taking every
 * dispatch and selector type with it.
 *
 * It is exported because the tests wrap it to observe every action a thunk
 * dispatches, which store.dispatch alone cannot show them.
 */
export const rootReducer = combineReducers({
  [commonSlice.name]: commonSlice.reducer,
  [loginSlice.name]: loginSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/*
 * Builds a store. Tests call this for an isolated one per case instead of
 * sharing the singleton below, which is what the application uses.
 *
 * The sign-in request is a dependency rather than state, so it is handed to
 * the thunks as their extra argument instead of being put in a slice where a
 * reducer could appear to change it.
 */
export const setupStore = (request: SignInRequest, preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: request } }),
  });

/*
 * There is no store at module scope: one cannot be built before the request
 * has been read off the URL, and index.tsx is where that happens.
 */
export type AppStore = ReturnType<typeof setupStore>;

/*
 * Dispatch is read off the configured store rather than declared, so the
 * middleware's contribution to it, which is what lets a thunk be dispatched and
 * awaited, cannot be forgotten here.
 */
export type AppDispatch = AppStore["dispatch"];

/*
 * The return type of a thunk is whatever its caller awaits, so it stays a
 * parameter. The third argument is the sign-in request: the parameters every
 * thunk that talks to the server needs, and which none of them may change.
 */
export type AppThunk<R = void> = ThunkAction<R, RootState, SignInRequest, UnknownAction>;
