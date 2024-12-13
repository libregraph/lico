import {
  RECEIVE_ERROR,
  RESET_HELLO,
  RECEIVE_HELLO,
  SERVICE_WORKER_NEW_CONTENT
} from '../actions/types';
import queryString from 'query-string';
import { ErrorType } from '../errors';

const query = queryString.parse(document.location.search);
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

type commonStateType =  {
  hello: { [key: string]: string | boolean | undefined | null | {[key: string]: string | boolean | string[] | undefined | null  } } |  null,
  branding: { bannerLogo: string, locales: string[] } | null,
  error: ErrorType,
  flow: string | (string | null)[],
  query: queryString.ParsedQuery<string>,
  pathPrefix: string,
  updateAvailable: boolean
}

const defaultState:commonStateType = {
  hello: null,
  branding: null,
  error: null,
  flow: flow,
  query: query,
  updateAvailable: false,
  pathPrefix: defaultPathPrefix
};


function commonReducer(state = defaultState, action: {type: string, error?: ErrorType | null, state: commonStateType | undefined, username: string | undefined, displayName: string | undefined, hello: null | undefined | {[key: string]: commonStateType | string | boolean}}) {
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
        branding: action.hello?.branding ? action.hello.branding : state.branding
      });

    case SERVICE_WORKER_NEW_CONTENT:
      return Object.assign({}, state, {
        updateAvailable: true
      });

    default:
      return state;
  }
}

export default commonReducer;
