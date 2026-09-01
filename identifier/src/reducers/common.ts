import queryString from 'query-string';

import type { AppAction } from '../actions/types';
import {
  RECEIVE_ERROR,
  RESET_HELLO,
  RECEIVE_HELLO
} from '../actions/types';
import type { Branding, Session } from '../models/api';

/*
 * query-string hands back an array when a parameter repeats. Every reader here
 * treats these as single values, and the OIDC request parameters are single
 * valued, so the map is named as strings rather than teaching each reader to
 * unwrap one.
 */
const query = queryString.parse(document.location.search) as Record<string, string>;
const flow = query.flow || '';
delete query.flow;

const defaultPathPrefix = (() => {
  const root = document.getElementById('root');
  let pathPrefix = root ? root.getAttribute('data-path-prefix') : null;
  if (!pathPrefix || pathPrefix === '__PATH_PREFIX__') {
    // Not replaced, probably we are running in debug mode or whatever. Use sane default.
    pathPrefix = '/signin/v1';
  }
  return pathPrefix;
})();

export interface CommonState {
  hello: Session | null;
  branding: Branding | null;
  error: Error | null;
  flow: string;
  query: Record<string, string>;
  pathPrefix: string;
}

const defaultState: CommonState = {
  hello: null,
  branding: null,
  error: null,
  flow: flow,
  query: query,
  pathPrefix: defaultPathPrefix
};

function commonReducer(state: CommonState = defaultState, action: AppAction): CommonState {
  switch (action.type) {
    case RECEIVE_ERROR:
      return Object.assign({}, state, {
        error: action.error
      });

    case RESET_HELLO:
      return Object.assign({}, state, {
        hello: null,
        branding: null
      });

    case RECEIVE_HELLO:
      return Object.assign({}, state, {
        hello: {
          state: action.state,
          username: action.username,
          displayName: action.displayName,
          details: action.hello
        },
        branding: action.hello.branding ? action.hello.branding : state.branding
      });

    default:
      return state;
  }
}

export default commonReducer;
