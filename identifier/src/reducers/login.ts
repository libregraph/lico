import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LoginError {
  [key: string]: Error;
}

interface LoginState {
  loading: string;
  username: string;
  password: string;
  errors: LoginError;
}

interface UpdateInputAction {
  name: string;
  value: string;
}

interface LogonAction {
  username: string;
  password: string;
}

interface ValidateLogonAction {
  errors: LoginError;
}

interface ReceiveLogonAction {
  success: boolean;
  errors?: LoginError;
}

interface ReceiveConsentAction {
  success: boolean;
  errors?: LoginError;
}

const initialState: LoginState = {
  loading: '',
  username: '',
  password: '',
  errors: {}
};

const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    receiveValidateLogon: (state, action: PayloadAction<ValidateLogonAction>) => {
      state.errors = action.payload.errors;
      state.loading = '';
    },
    
    requestLogon: (state, action: PayloadAction<LogonAction>) => {
      state.loading = 'REQUEST_LOGON';
      state.errors = {};
    },
    
    requestConsentAllow: (state) => {
      state.loading = 'REQUEST_CONSENT_ALLOW';
      state.errors = {};
    },
    
    requestConsentCancel: (state) => {
      state.loading = 'REQUEST_CONSENT_CANCEL';
      state.errors = {};
    },
    
    receiveLogon: (state, action: PayloadAction<ReceiveLogonAction>) => {
      if (!action.payload.success) {
        state.errors = action.payload.errors || {};
        state.loading = '';
      }
    },
    
    receiveConsent: (state, action: PayloadAction<ReceiveConsentAction>) => {
      if (!action.payload.success) {
        state.errors = action.payload.errors || {};
        state.loading = '';
      }
    },
    
    receiveLogoff: (state) => {
      state.username = '';
      state.password = '';
    },
    
    updateInput: (state, action: PayloadAction<UpdateInputAction>) => {
      delete state.errors[action.payload.name];
      (state as any)[action.payload.name] = action.payload.value;
    }
  }
});

export const {
  receiveValidateLogon,
  requestLogon,
  requestConsentAllow,
  requestConsentCancel,
  receiveLogon,
  receiveConsent,
  receiveLogoff,
  updateInput
} = loginSlice.actions;

export default loginSlice.reducer;