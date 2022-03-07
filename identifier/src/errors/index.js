import { injectIntl, defineMessages } from 'react-intl';

export const ERROR_LOGIN_VALIDATE_MISSINGUSERNAME = 'konnect.error.login.validate.missingUsername';
export const ERROR_LOGIN_VALIDATE_MISSINGPASSWORD = 'konnect.error.login.validate.missingPassword';
export const ERROR_LOGIN_FAILED = 'konnect.error.login.failed';
export const ERROR_HTTP_NETWORK_ERROR = 'konnet.error.http.networkError';
export const ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS = 'konnect.error.http.unexpectedResponseStatus';
export const ERROR_HTTP_UNEXPECTED_RESPONSE_STATE = 'konnect.error.http.unexpectedResponseState';

// Translatable error messages.
const translations = defineMessages({
  [ERROR_LOGIN_VALIDATE_MISSINGUSERNAME]: {
    id: 'konnect.error.login.validate.missingUsername',
    defaultMessage: 'Enter a valid {what}.'
  },
  [ERROR_LOGIN_VALIDATE_MISSINGPASSWORD]: {
    id: 'konnect.error.login.validate.missingPassword',
    defaultMessage: 'Enter your password.'
  },
  [ERROR_LOGIN_FAILED]: {
    id: 'konnect.error.login.failed',
    defaultMessage: 'Logon failed. Please verify your credentials and try again.'
  },
  [ERROR_HTTP_NETWORK_ERROR]: {
    id: 'konnet.error.http.networkError',
    defaultMessage: 'Network error. Please check your connection and try again.'
  },
  [ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS]: {
    id: 'konnect.error.http.unexpectedResponseStatus',
    defaultMessage: 'Unexpected HTTP response: {status}. Please check your connection and try again.'
  },
  [ERROR_HTTP_UNEXPECTED_RESPONSE_STATE]: {
    id: 'konnect.error.http.unexpectedResponseState',
    defaultMessage: 'Unexpected response state: {state}'
  }
});

// Error with values.
export class ExtendedError extends Error {
  values = undefined;

  constructor(message, values) {
    super(message);
    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, ExtendedError);
    }
    this.values = values;
  }
}

// Component to translate error text with values.
function ErrorMessageComponent(props) {
  const { error, intl, values } = props;

  if (!error) {
    return null;
  }

  const id = error.id ? error.id : error.message;
  const messageDescriptor = Object.assign({}, {
    id,
    defaultMessage: error.id ? error.message : undefined
  }, translations[id]);

  return intl.formatMessage(messageDescriptor, {...error.values, ...values});
}

export const ErrorMessage = injectIntl(ErrorMessageComponent);
