import type { ThunkAction, UnknownAction } from "@reduxjs/toolkit";
import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { commonSlice } from "./reducers/common";
import { loginSlice } from "./reducers/login";

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
 */
export const setupStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

export const store = setupStore();

export type AppStore = ReturnType<typeof setupStore>;

/*
 * Dispatch is read off the configured store rather than declared, so the
 * middleware's contribution to it, which is what lets a thunk be dispatched and
 * awaited, cannot be forgotten here.
 */
export type AppDispatch = AppStore["dispatch"];

/*
 * The return type of a thunk is whatever its caller awaits, so it stays a
 * parameter. The third argument is `undefined` rather than `unknown`, because
 * no thunk here is given an extra argument and saying so keeps reaching for one
 * a type error.
 */
export type AppThunk<R = void> = ThunkAction<R, RootState, undefined, UnknownAction>;

export default store;
