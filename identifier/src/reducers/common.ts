import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import queryString from 'query-string';

interface HelloDetails {
  state: boolean;
  username?: string;
  displayName?: string;
  details: any;
}

interface BrandingInfo {
  [key: string]: any;
}

interface CommonState {
  hello: HelloDetails | null;
  branding: BrandingInfo | null;
  error: any;
  flow: string;
  query: any;
  updateAvailable: boolean;
  pathPrefix: string;
}

interface ReceiveErrorAction {
  error: any;
}

interface ReceiveHelloAction {
  state: boolean;
  username?: string;
  displayName?: string;
  hello: any;
}

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

const initialState: CommonState = {
  hello: null,
  branding: null,
  error: null,
  flow: flow as string,
  query: query,
  updateAvailable: false,
  pathPrefix: defaultPathPrefix
};

const commonSlice = createSlice({
  name: 'common',
  initialState,
  reducers: {
    receiveError: (state, action: PayloadAction<ReceiveErrorAction>) => {
      state.error = action.payload.error;
    },
    
    resetHello: (state) => {
      state.hello = null;
      state.branding = null;
    },
    
    receiveHello: (state, action: PayloadAction<ReceiveHelloAction>) => {
      state.hello = {
        state: action.payload.state,
        username: action.payload.username,
        displayName: action.payload.displayName,
        details: action.payload.hello
      };
      state.branding = action.payload.hello.branding ? action.payload.hello.branding : state.branding;
    },
    
    serviceWorkerNewContent: (state) => {
      state.updateAvailable = true;
    }
  }
});

export const {
  receiveError,
  resetHello,
  receiveHello,
  serviceWorkerNewContent
} = commonSlice.actions;

export default commonSlice.reducer;