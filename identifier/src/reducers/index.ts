import { combineReducers } from '@reduxjs/toolkit';

import commonReducer from './common';
import loginReducer from './login';

const rootReducer = combineReducers({
  common: commonReducer,
  login: loginReducer
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;