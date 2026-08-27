import { createStore, applyMiddleware, compose } from 'redux';
import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';

import rootReducer from './reducers';

const middlewares = [
  thunkMiddleware
];

// The action logger is for interactive development only and must not be part of
// a production build. Test mode is excluded as well, matching how
// vite.config.js gates the checker plugin.
if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
  middlewares.push(createLogger()); // Must be last middleware in the chain.
}

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(
    ...middlewares,
  ))
);

export default store;
