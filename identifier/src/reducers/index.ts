import { combineReducers } from "redux";

import type { AppAction } from "../actions/types";
import type { CommonState } from "./common";
import commonReducer from "./common";
import type { LoginState } from "./login";
import loginReducer from "./login";

/*
 * The shape of the store. combineReducers is told to produce exactly this, so a
 * slice whose reducer stops matching is a type error here rather than a
 * surprise at whichever selector reads it.
 */
export interface RootState {
  common: CommonState;
  login: LoginState;
}

const rootReducer = combineReducers<RootState, AppAction>({
  common: commonReducer,
  login: loginReducer,
});

export default rootReducer;
