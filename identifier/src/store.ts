import { createStore, applyMiddleware, compose, AnyAction, Action, EmptyObject } from 'redux';
import thunkMiddleware, { ThunkDispatch, ThunkMiddleware } from 'redux-thunk';
import { createLogger } from 'redux-logger';

import rootReducer from './reducers';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

type IAppState = ReturnType<typeof rootReducer>;

const middlewares: ThunkMiddleware<IAppState, AnyAction, undefined>[]  = [
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
export type PromiseDispatch = ThunkDispatch<RootState, EmptyObject, Action>;

export default store;
