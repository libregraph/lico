import {
  RECEIVE_VALIDATE_LOGON,
  REQUEST_LOGON,
  RECEIVE_LOGON,
  RECEIVE_LOGOFF,
  REQUEST_CONSENT_ALLOW,
  REQUEST_CONSENT_CANCEL,
  RECEIVE_CONSENT,
  UPDATE_INPUT
} from '../actions/types';
import { ErrorType } from '../errors';


type loginState = {
  loading: string,
  username: string,
  password: string,
  errors: ErrorType
}

function loginReducer(state:loginState = {
  loading: '',
  username: '',
  password: '',
  errors: {}
}, action: {errors?: Error | { [key: string]: string | Error | boolean | null }, type: string, success?: boolean, name?: string, value?: string | null}) {
  switch (action.type) {
    case RECEIVE_VALIDATE_LOGON:
      return Object.assign({}, state, {
        errors: action.errors,
        loading: ''
      });

    case REQUEST_CONSENT_ALLOW:
    case REQUEST_CONSENT_CANCEL:
    case REQUEST_LOGON:
      return Object.assign({}, state, {
        loading: action.type,
        errors: {}
      });

    case RECEIVE_CONSENT:
    case RECEIVE_LOGON:
      if (!action.success) {
        return Object.assign({}, state, {
          errors: action.errors ? action.errors : {},
          loading: ''
        });
      }
      return state;

    case RECEIVE_LOGOFF:
      return Object.assign({}, state, {
        username: '',
        password: ''
      });

    case UPDATE_INPUT:
      if(action.name){
        if(state.errors){
          delete state.errors[action.name];
        }
        return Object.assign({}, state, {
        [action.name]: action.value
        });
      }
      else{
        return state;
      }

    default:
      return state;
  }
}

export default loginReducer;
