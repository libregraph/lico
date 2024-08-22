import { createStore, applyMiddleware, compose, Middleware, AnyAction, Action, Dispatch } from 'redux';
import thunkMiddleware, { ThunkAction, ThunkDispatch, ThunkMiddleware } from 'redux-thunk';
import { createLogger } from 'redux-logger';

import rootReducer from './reducers';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

const middlewares: (Middleware<{}, any, any> | (ThunkMiddleware<any, AnyAction, undefined> & { withExtraArgument<ExtraThunkArg, State = any, BasicAction extends Action<any> = AnyAction>(extraArgument: ExtraThunkArg): ThunkMiddleware<any>; }))[] = [
  thunkMiddleware
];

if (process.env.NODE_ENV !== 'development') { // eslint-disable-line no-undef
  middlewares.push(createLogger()); // must be last middleware in the chain.
}

const composeEnhancers = (window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'] as typeof compose) || compose || compose;

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(
    ...middlewares,
  ))
);

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch;
export type PromiseDispatch = ThunkDispatch<RootState, any, Action>;

export default store;
