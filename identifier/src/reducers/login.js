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

function loginReducer(state = {
  loading: '',
  username: '',
  password: '',
  errors: {}
}, action) {
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

    case UPDATE_INPUT: {
      // Editing a field clears the error recorded for it. The previous state
      // must not be touched, so copy the errors rather than deleting from them.
      const errors = Object.assign({}, state.errors);
      delete errors[action.name];

      return Object.assign({}, state, {
        errors,
        [action.name]: action.value
      });
    }

    default:
      return state;
  }
}

export default loginReducer;
