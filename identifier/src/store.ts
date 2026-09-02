import type { Middleware } from "redux";
import { applyMiddleware, compose, createStore } from "redux";
import type { ThunkAction, ThunkDispatch } from "redux-thunk";
import thunkMiddleware from "redux-thunk";

import type { AppAction } from "./actions/types";
import type { RootState } from "./reducers";
import rootReducer from "./reducers";

const middlewares: Middleware[] = [thunkMiddleware];

/*
 * The devtools extension replaces compose when it is installed. It is not part
 * of the application, so it is declared here rather than globally, and the
 * fallback is what runs in production.
 */
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(rootReducer, composeEnhancers(applyMiddleware(...middlewares)));

/*
 * Dispatch accepts both plain actions and the thunks the action creators
 * return. It is named rather than read off the store, because the devtools
 * compose above is untyped and would erase the middleware's contribution.
 */
export type AppDispatch = ThunkDispatch<RootState, undefined, AppAction>;

// The return type of a thunk is whatever its caller awaits, so it stays a
// parameter here.
export type AppThunk<R = void> = ThunkAction<R, RootState, undefined, AppAction>;

export default store;
